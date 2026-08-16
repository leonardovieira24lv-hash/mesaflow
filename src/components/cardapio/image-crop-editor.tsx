"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { createPortal } from "react-dom";
import { Crosshair, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { ModalDialogContext } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
/** Lado (em px) do canvas exportado — quadrado, igual ao card do produto. Alto o suficiente pra ficar nítido, sem gerar um arquivo desnecessariamente grande. */
const OUTPUT_SIZE = 1200;
const OUTPUT_QUALITY = 0.9;

interface Point {
  x: number;
  y: number;
}

interface ImageCropEditorProps {
  open: boolean;
  /** Arquivo já validado (tipo/tamanho) por quem chama — este componente só cuida do enquadramento. */
  file: File | null;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
  isSaving?: boolean;
}

function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpointOf(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function pointsOf(map: Map<number, Point>): Point[] {
  const points: Point[] = [];
  map.forEach((point) => points.push(point));
  return points;
}

/**
 * Editor de enquadramento da foto (Sprint "Editor de Enquadramento da Foto
 * do Produto", 2026-07-29) — passo novo entre selecionar o arquivo e o
 * upload de verdade: `<ProductImageUpload>`/`<CategoryImageUpload>` abrem
 * este editor com o arquivo escolhido; só ao clicar em "Salvar" o recorte
 * vira um Blob e segue pro Storage.
 *
 * Implementação 100% nativa (Pointer Events + Canvas 2D) — nenhuma
 * biblioteca de recorte adicionada, por pedido explícito de manter uma
 * solução leve. Um único caminho de código atende mouse (desktop) e toque
 * (Android/iOS): Pointer Events unifica os dois; a diferença entre
 * "arrastar" e "pinça" é só quantos ponteiros estão ativos ao mesmo tempo
 * (`activePointers`).
 *
 * Matemática do enquadramento: a pré-visualização é sempre um quadrado
 * (mesmo formato do card do produto). A imagem é desenhada em "cover"
 * (`baseScale`) — nunca sobra vão vazio — multiplicada pelo zoom do
 * usuário (`zoom`, sempre ≥ 1) e deslocada por `offset`. `offset` é sempre
 * limitado (`clampOffset`) para a imagem nunca deixar de cobrir o
 * quadrado inteiro — é isso que garante que a imagem "nunca fique
 * distorcida" (a escala em X e em Y é sempre a mesma, só translação e
 * zoom uniforme, nunca esticar um eixo mais que o outro).
 *
 * Bug real encontrado (2026-08-15, relatado pelo dono com vídeo — foto de
 * categoria "salvando" sem erro nem sucesso, nunca persistindo): este
 * editor usa `<Modal>` (portanto um `<dialog>` nativo) por baixo, e SEMPRE
 * é usado ANINHADO dentro de outro modal já aberto ("Editar
 * categoria"/"Editar produto"). Dois `<dialog>` nativos empilhados — o
 * vídeo mostrou os DOIS fechando juntos, no mesmo quadro, assim que
 * "Salvar" era tocado aqui dentro: o clique "vazava" pro backdrop do modal
 * de trás e fechava ele também, ANTES do formulário de categoria/produto
 * conseguir mandar o `imageUrl` pro servidor — por isso a foto nunca
 * persistia, sem erro nenhum (o formulário de fora nunca chegou a tentar
 * salvar, só foi descartado como se tivesse cancelado).
 *
 * 1ª tentativa de correção (revertida): trocar este editor pra não usar
 * `<dialog>` nativo (uma camada `position: fixed` simples). Quebrou a
 * pilha visual — um `<dialog>` aberto via `showModal()` entra na "top
 * layer" do navegador, que sempre desenha por CIMA de qualquer conteúdo
 * comum, não importa o z-index. Com o modal de fora continuando
 * `<dialog>`, o editor de recorte (agora uma div comum) passou a aparecer
 * ATRÁS dele — nunca deveria ter sido essa a correção.
 *
 * 2ª tentativa de correção (também revertida): manter `<dialog>` aqui
 * (pilha visual restaurada) e só endurecer o clique-fora-fecha do modal
 * de trás (`Modal.tsx`, exigir `pointerdown`+`click` no mesmo backdrop).
 * Gravação de tela nova (2026-08-16) provou que NADA mudou — o problema
 * nunca foi um clique vazando pro backdrop.
 *
 * Correção real (3ª tentativa): nenhuma das duas tentativas anteriores
 * atacava a causa de verdade — dois `<dialog>` nativos abertos ao mesmo
 * tempo são frágeis, ponto final, seja qual for o mecanismo exato do
 * navegador por trás disso. A correção que resolve de vez: NUNCA ter um
 * 2º `<dialog>` — este editor não abre mais o seu próprio, ele se PORTA
 * pra DENTRO do `<dialog>` que já está aberto (via `ModalDialogContext`,
 * exposto pelo `<Modal>` mais próximo — ver `modal.tsx`), cobrindo o
 * formulário por baixo com CSS simples (`absolute inset-0`). Existe,
 * durante todo o fluxo, exatamente 1 `<dialog>` nativo — nunca 2.
 */
export function ImageCropEditor({ open, file, onCancel, onSave, isSaving }: ImageCropEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const portalTarget = useContext(ModalDialogContext);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [viewportSize, setViewportSize] = useState(300);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Ponteiros ativos (toque ou mouse) — chave é o `pointerId` nativo do
  // navegador. 1 ponteiro = arrastar; 2 = pinça (zoom + pan simultâneos).
  const activePointers = useRef<Map<number, Point>>(new Map());
  // Referências do início do gesto atual — usadas pra calcular a posição
  // de forma absoluta a cada movimento (em vez de acumular incrementos a
  // cada evento, o que deriva/acumula erro ao longo de muitos eventos).
  const gestureStart = useRef<{
    offset: Point;
    zoom: number;
    singlePoint?: Point;
    pinchDistance?: number;
    pinchMidpoint?: Point;
  } | null>(null);

  const baseScale = useMemo(() => {
    if (!naturalSize) return 1;
    return Math.max(viewportSize / naturalSize.w, viewportSize / naturalSize.h);
  }, [naturalSize, viewportSize]);

  const renderedSize = useMemo(() => {
    if (!naturalSize) return { w: viewportSize, h: viewportSize };
    return { w: naturalSize.w * baseScale * zoom, h: naturalSize.h * baseScale * zoom };
  }, [naturalSize, baseScale, zoom, viewportSize]);

  const clampOffset = useCallback(
    (candidate: Point, renderedW: number, renderedH: number): Point => {
      const minX = viewportSize - renderedW;
      const minY = viewportSize - renderedH;
      return {
        x: Math.min(0, Math.max(minX, candidate.x)),
        y: Math.min(0, Math.max(minY, candidate.y)),
      };
    },
    [viewportSize],
  );

  const centeredOffsetFor = useCallback(
    (renderedW: number, renderedH: number): Point => ({
      x: (viewportSize - renderedW) / 2,
      y: (viewportSize - renderedH) / 2,
    }),
    [viewportSize],
  );

  // Carrega o arquivo (novo object URL) e mede as dimensões naturais toda
  // vez que um arquivo diferente chega — reseta zoom/posição pro estado
  // inicial (imagem inteira cobrindo o quadrado, centralizada).
  useEffect(() => {
    if (!file) {
      setImageUrl(null);
      setNaturalSize(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setError(null);

    const img = new window.Image();
    img.onload = () => {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      setZoom(1);
    };
    img.onerror = () => setError("Não foi possível carregar essa imagem para edição.");
    img.src = url;

    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Mede o quadrado de pré-visualização (responsivo) e recentraliza a
  // imagem sempre que as dimensões naturais ficam disponíveis pela
  // primeira vez ou o container muda de tamanho (ex.: rotação de tela).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => setViewportSize(container.clientWidth);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!naturalSize) return;
    const w = naturalSize.w * baseScale * 1;
    const h = naturalSize.h * baseScale * 1;
    setOffset(centeredOffsetFor(w, h));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando a imagem (re)carrega, não a cada mudança de zoom/offset
  }, [naturalSize, viewportSize]);

  function pointFromEvent(e: ReactPointerEvent<HTMLDivElement>): Point {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!naturalSize) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointers.current.set(e.pointerId, pointFromEvent(e));

    if (activePointers.current.size === 1) {
      const [point] = pointsOf(activePointers.current);
      // Guarda explícita: com `noUncheckedIndexedAccess` ligado no
      // tsconfig, um elemento de array desestruturado é sempre `T | undefined`
      // pro TypeScript, mesmo quando a lógica garante que ele existe (aqui,
      // `size === 1` acabou de confirmar que há exatamente 1 ponto). Em vez
      // de calar isso com `!`/`as Point`, a guarda abaixo faz o TypeScript
      // estreitar `point` pra `Point` de verdade no restante do bloco — e
      // também protege o runtime caso essa invariante um dia deixe de valer.
      if (!point) return;
      gestureStart.current = { offset, zoom, singlePoint: point };
    } else if (activePointers.current.size === 2) {
      const [a, b] = pointsOf(activePointers.current);
      if (!a || !b) return;
      gestureStart.current = {
        offset,
        zoom,
        pinchDistance: distanceBetween(a, b),
        pinchMidpoint: midpointOf(a, b),
      };
    }
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!naturalSize || !activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, pointFromEvent(e));
    const start = gestureStart.current;
    if (!start) return;

    if (activePointers.current.size === 1 && start.singlePoint) {
      const [current] = pointsOf(activePointers.current);
      if (!current) return;
      const dx = current.x - start.singlePoint.x;
      const dy = current.y - start.singlePoint.y;
      const renderedW = naturalSize.w * baseScale * start.zoom;
      const renderedH = naturalSize.h * baseScale * start.zoom;
      setOffset(clampOffset({ x: start.offset.x + dx, y: start.offset.y + dy }, renderedW, renderedH));
      return;
    }

    if (activePointers.current.size === 2 && start.pinchDistance && start.pinchMidpoint) {
      const [a, b] = pointsOf(activePointers.current);
      if (!a || !b) return;
      const currentDistance = distanceBetween(a, b);
      const currentMidpoint = midpointOf(a, b);

      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, start.zoom * (currentDistance / start.pinchDistance)));
      const oldRenderedW = naturalSize.w * baseScale * start.zoom;
      const newRenderedW = naturalSize.w * baseScale * newZoom;
      const newRenderedH = naturalSize.h * baseScale * newZoom;
      const scaleRatio = newRenderedW / oldRenderedW;

      // Zoom em torno do ponto médio inicial da pinça + pan pelo quanto o
      // ponto médio se moveu — os dois gestos (afastar os dedos e
      // arrastá-los juntos) funcionam ao mesmo tempo, como se espera de um
      // editor de foto nativo.
      const panDx = currentMidpoint.x - start.pinchMidpoint.x;
      const panDy = currentMidpoint.y - start.pinchMidpoint.y;
      const newOffsetX = start.pinchMidpoint.x - (start.pinchMidpoint.x - start.offset.x) * scaleRatio + panDx;
      const newOffsetY = start.pinchMidpoint.y - (start.pinchMidpoint.y - start.offset.y) * scaleRatio + panDy;

      setZoom(newZoom);
      setOffset(clampOffset({ x: newOffsetX, y: newOffsetY }, newRenderedW, newRenderedH));
    }
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size === 0) {
      gestureStart.current = null;
    } else if (activePointers.current.size === 1) {
      // Sobrou 1 dedo depois de uma pinça de 2 — reinicia a referência do
      // gesto pra esse ponto, senão o próximo movimento salta.
      const [point] = pointsOf(activePointers.current);
      if (!point) return;
      gestureStart.current = { offset, zoom, singlePoint: point };
    }
  }

  function applyZoomDelta(factor: number, focal?: Point) {
    if (!naturalSize) return;
    const focalPoint = focal ?? { x: viewportSize / 2, y: viewportSize / 2 };
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    const oldRenderedW = naturalSize.w * baseScale * zoom;
    const newRenderedW = naturalSize.w * baseScale * newZoom;
    const newRenderedH = naturalSize.h * baseScale * newZoom;
    const scaleRatio = newRenderedW / oldRenderedW;

    const newOffsetX = focalPoint.x - (focalPoint.x - offset.x) * scaleRatio;
    const newOffsetY = focalPoint.y - (focalPoint.y - offset.y) * scaleRatio;

    setZoom(newZoom);
    setOffset(clampOffset({ x: newOffsetX, y: newOffsetY }, newRenderedW, newRenderedH));
  }

  function handleWheel(e: ReactWheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const focal = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    applyZoomDelta(e.deltaY < 0 ? 1.08 : 1 / 1.08, focal);
  }

  function handleCenter() {
    setOffset(centeredOffsetFor(renderedSize.w, renderedSize.h));
  }

  function handleReset() {
    if (!naturalSize) return;
    const w = naturalSize.w * baseScale;
    const h = naturalSize.h * baseScale;
    setZoom(1);
    setOffset(centeredOffsetFor(w, h));
  }

  async function handleSave() {
    if (!naturalSize || !imgRef.current) return;
    setIsExporting(true);
    setError(null);

    try {
      const scale = baseScale * zoom;
      // Retângulo visível (em espaço de tela) convertido de volta para
      // pixels naturais da imagem original — sempre um quadrado dos dois
      // lados (origem e destino), então a escala em X e em Y é sempre
      // idêntica: nunca distorce.
      const sx = -offset.x / scale;
      const sy = -offset.y / scale;
      const sSize = viewportSize / scale;

      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no-canvas-context");

      ctx.drawImage(imgRef.current, sx, sy, sSize, sSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", OUTPUT_QUALITY));
      if (!blob) throw new Error("no-blob");

      onSave(blob);
    } catch {
      setError("Não foi possível processar o enquadramento. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  }

  const busy = isSaving || isExporting;

  if (!open) return null;

  return createPortal(
    <div className="absolute inset-0 z-20 flex flex-col overflow-y-auto rounded-ds2-lg bg-ds2-surface p-7 text-ds2-foreground">
      <div className="flex items-start justify-between gap-4 pb-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-xl font-semibold tracking-tight text-ds2-foreground">
            Ajustar enquadramento
          </h2>
          <p className="text-sm text-ds2-foreground-muted">
            Arraste para posicionar e use o zoom para ajustar como a foto aparece no cardápio.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCancel}
          aria-label="Fechar"
          disabled={busy}
          className="-mr-2 -mt-2 h-8 w-8 shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-4 pb-2">
        {error && <Alert variant="destructive">{error}</Alert>}

        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          className="relative mx-auto aspect-square w-full max-w-[320px] touch-none select-none overflow-hidden rounded-ds2-lg border border-ds2-border bg-ds2-surface-hover"
        >
          {imageUrl && naturalSize && (
            // eslint-disable-next-line @next/next/no-img-element -- posicionamento manual via transform, fora do fluxo de otimização do <Image>
            <img
              ref={imgRef}
              src={imageUrl}
              alt=""
              draggable={false}
              className="absolute left-0 top-0 max-w-none"
              style={{
                width: `${renderedSize.w}px`,
                height: `${renderedSize.h}px`,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
        </div>

        <div className="flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => applyZoomDelta(1 / 1.2)}
            disabled={!naturalSize || busy}
            aria-label="Reduzir zoom"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => applyZoomDelta(1.2)}
            disabled={!naturalSize || busy}
            aria-label="Ampliar zoom"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleCenter} disabled={!naturalSize || busy}>
            <Crosshair className="h-4 w-4" />
            Centralizar imagem
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleReset} disabled={!naturalSize || busy}>
            <RotateCcw className="h-4 w-4" />
            Redefinir
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-5">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSave} isLoading={busy} disabled={!naturalSize}>
          Salvar
        </Button>
      </div>
    </div>,
    portalTarget ?? document.body,
  );
}
