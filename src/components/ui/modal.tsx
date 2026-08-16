"use client";

import { createContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  /** Esconde o cabeçalho de título/descrição (ex.: modal só com conteúdo customizado). */
  hideHeader?: boolean;
  className?: string;
}

/**
 * Elemento `<dialog>` do `<Modal>` mais próximo — exposto pra quem
 * precisa "tomar conta" da tela inteira de um modal já aberto, sem abrir
 * um SEGUNDO `<dialog>` nativo por cima (ver `image-crop-editor.tsx` pro
 * caso de uso real e o bug que isso resolveu). `null` fora de um
 * `<Modal>` — quem consome decide o que fazer nesse caso (normalmente,
 * portar pro `document.body` como alternativa).
 */
export const ModalDialogContext = createContext<HTMLDialogElement | null>(null);

/**
 * Modal base do MesaFlow, construído sobre `<dialog>` nativo: foco preso
 * automaticamente dentro do modal, tecla Esc fecha, `::backdrop` cuida do
 * overlay — sem reimplementar nada disso manualmente.
 *
 * Para confirmações (excluir, cancelar), preferir `<ConfirmDialog>`, que já
 * usa este componente por baixo com o rótulo/variante certos.
 *
 * `animate-scale-in` usa sua duração/easing atuais (0.15s ease-out),
 * divergentes do padrão oficial de entrada de Modal (`ds2-duration-slow`/
 * `ds2-ease`, seção 10 do MesaFlow Visual Language) — não corrigido: essa
 * animação é compartilhada com telas públicas do Cardápio do cliente,
 * ajustar sua duração afeta lá também.
 *
 * Sprint 13.14 — renderizado via `createPortal`, não mais como filho
 * normal de quem o chama. Antes, um `<ConfirmDialog>` (que usa este
 * componente) aberto de dentro de outro `<dialog>` nativo já aberto (ex.:
 * confirmar "Cancelar item" dentro do Drawer da mesa) ficava aninhado no
 * DOM — `<dialog>` dentro de `<dialog>`, os dois abertos via
 * `showModal()`. Relatado na prática: fechar o de confirmação (mesmo só
 * dispensando, sem confirmar) às vezes fechava o de fora junto, voltando
 * pra tela anterior sem motivo. `<dialog>` aninhado tem comportamento
 * conhecidamente inconsistente entre navegadores — a correção padrão é
 * não aninhar de verdade no DOM.
 *
 * Sprint 13.17 — correção da correção acima: portar sempre pra
 * `document.body` resolvia o aninhamento, mas criava um bug novo, só
 * percebido depois — `document.body` fica FORA da `<div class="ds2-dark">`
 * que carrega o tema vermelho do painel administrativo (aplicada só uma
 * vez, no layout raiz do admin). Todo modal (Fechar Caixa, Liberar mesa,
 * Cancelar pedido, Excluir categoria...) passou a resolver `ds2-*` pela
 * "ponte" do Cardápio Público em `:root` (verde), não pelo vermelho do
 * admin — regressão real, relatada como "o modal ainda tem tom de verde".
 * Agora, em vez de portar sempre pro `<body>`, um `<span>` invisível fica
 * na posição NORMAL da árvore (nunca aparece, só existe pra achar onde
 * este componente "estaria" no DOM) — na montagem, sobe a árvore
 * (`closest`) procurando `.ds2-dark`/`.menu-dark`; se achar, porta ali
 * dentro (preserva o tema, e ainda resolve o aninhamento — o alvo é o
 * wrapper do layout, nunca outro `<dialog>`); se não achar (ex.: tela de
 * Login, sem nenhum dos dois), cai em `document.body` como antes.
 */
export function Modal({ open, onClose, title, description, children, footer, hideHeader, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  // Alimenta `ModalDialogContext` — só existe de verdade DEPOIS que
  // `portalTarget` resolve e o `<dialog>` é criado (mesma ordem de
  // sempre: `ref.current` só é confiável depois do commit). `[portalTarget]`
  // como dependência é o suficiente pra pegar o momento certo, mesmo raciocínio
  // do efeito de `showModal()` logo abaixo.
  const [dialogNode, setDialogNode] = useState<HTMLDialogElement | null>(null);
  // Bug real encontrado (2026-08-14): `id="modal-title"` era fixo, igual
  // em toda instância de `<Modal>`. Nunca deu problema enquanto só existia
  // 1 modal montado por vez na tela inteira — mas o próprio `<dialog>`
  // NUNCA desmonta quando fechado (só `showModal()`/`close()`, olhe o
  // efeito abaixo), então a partir do momento em que passamos a ter mais
  // de 1 `<Modal>` montado ao mesmo tempo na mesma tela (Sistema de
  // Opcionais embutido por categoria, Parada técnica de reorganização),
  // vários `id="modal-title"` idênticos coexistiam no HTML — e
  // formulários com `form="algum-id-fixo"` fora do próprio `<form>`
  // (como o de criar grupo de opção) passaram a se ligar ao PRIMEIRO
  // elemento com aquele id no documento, não necessariamente ao do modal
  // realmente aberto. `useId()` torna isto único por instância, sempre.
  const titleId = useId();
  // Ver comentário completo no `onClick` do backdrop, mais abaixo.
  const pointerDownOnBackdrop = useRef(false);

  useEffect(() => {
    const themedAncestor = anchorRef.current?.closest(".ds2-dark, .menu-dark");
    setPortalTarget(themedAncestor ?? document.body);
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
    setDialogNode(dialog);
    // Bug real encontrado (2026-08-15, relatado pelo dono — QR Code da
    // mesa "reagia" ao toque mas nunca abria, em computador E celular,
    // sessão nova, sem nada de cache): faltava `portalTarget` aqui. Um
    // modal SEMPRE montado (ex.: `<ConfirmDialog open={Boolean(x)}>`,
    // nunca desmonta, só alterna `open`) nunca bate nisso — o efeito que
    // resolve `portalTarget` já rodou muito antes do primeiro `open:
    // true` de verdade. Mas um modal montado só SOB DEMANDA (ex.:
    // `{qrTable && <TableQrModal open .../>}`, como o de QR) nasce com
    // `open: true` desde a primeira renderização — nessa primeira
    // passada, `portalTarget` ainda é `null` (só é resolvido depois, no
    // outro efeito abaixo), então o `<dialog>` de verdade nem existe no
    // HTML ainda (`ref.current` é `null`) e este efeito não faz nada. Ele
    // só roda de novo quando algo na lista de dependências muda — e
    // como aqui só tinha `[open]`, e `open` continua `true` a vida
    // inteira desse modal, o efeito nunca é re-executado depois que
    // `portalTarget` finalmente resolve e o `<dialog>` passa a existir de
    // verdade. `showModal()` nunca é chamado — o elemento existe, mas
    // fica no estado padrão (fechado) pra sempre. Com `portalTarget` na
    // lista, o efeito roda de novo assim que o `<dialog>` passa a existir
    // de verdade, e aí sim chama `showModal()`.
  }, [open, portalTarget]);

  const dialogElement = (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onPointerDown={(e) => {
        // Guarda o alvo de ONDE o clique começou — usado pelo onClick
        // abaixo. Ver comentário lá pro motivo.
        pointerDownOnBackdrop.current = e.target === ref.current;
      }}
      onClick={(e) => {
        // Fecha ao clicar no backdrop (fora do <div> de conteúdo) — mas só
        // se o clique também tiver COMEÇADO no backdrop (`pointerDownOnBackdrop`).
        //
        // Bug real encontrado (2026-08-15, relatado pelo dono com vídeo —
        // foto de categoria "salvando" mas nunca persistindo): o editor de
        // recorte de foto é um `<dialog>` aninhado DENTRO deste modal
        // (categoria/produto). Tocar em "Salvar" dentro dele fecha aquele
        // `<dialog>` de dentro — e o vídeo mostrou os dois fechando
        // JUNTOS, no mesmo quadro: o clique "vazava" pro backdrop deste
        // modal de fora e fechava ele também, antes do formulário
        // conseguir salvar. Suspeita: um clique "fantasma", só a fase de
        // soltar o dedo, disparado depois que o `<dialog>` de dentro some
        // do meio do gesto — sem uma fase de "pressionar" de verdade
        // registrada aqui. Exigir que a MESMA interação tenha começado
        // E terminado no backdrop deste modal filtra esse tipo de clique
        // fantasma, sem perder o comportamento normal de "tocar fora
        // fecha" pra um toque de verdade do usuário.
        if (e.target === ref.current && pointerDownOnBackdrop.current) onClose();
        pointerDownOnBackdrop.current = false;
      }}
      // `hideHeader` omite o `<h2 id="modal-title">` — sem isso,
      // `aria-labelledby="modal-title"` fixo apontaria para um id
      // inexistente e o diálogo ficaria sem nome acessível para leitores de
      // tela. Sprint 10 (auditoria): nenhum consumidor usa `hideHeader` hoje,
      // mas corrigido aqui porque é o tipo de bug que só aparece quando
      // alguém finalmente usar a opção — melhor não deixar a armadilha.
      aria-labelledby={hideHeader ? undefined : titleId}
      aria-label={hideHeader ? title : undefined}
      className={cn(
        "relative m-auto w-full max-w-md rounded-ds2-lg border border-ds2-border bg-ds2-surface p-0 text-ds2-foreground shadow-ds2-lg",
        "backdrop:bg-black/50 backdrop:backdrop-blur-[2px]",
        "open:animate-scale-in",
        className,
      )}
    >
      {!hideHeader && (
        <div className="flex items-start justify-between gap-4 p-7 pb-4">
          <div className="flex flex-col gap-1.5">
            <h2 id={titleId} className="font-display text-xl font-semibold tracking-tight text-ds2-foreground">
              {title}
            </h2>
            {description && <p className="text-sm text-ds2-foreground-muted">{description}</p>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-2 -mt-2 h-8 w-8 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="px-7">
        <ModalDialogContext.Provider value={dialogNode}>{children}</ModalDialogContext.Provider>
      </div>

      {footer && <div className="flex items-center justify-end gap-3 p-7 pt-5">{footer}</div>}
    </dialog>
  );

  if (!portalTarget) return <span ref={anchorRef} aria-hidden className="hidden" />;
  return (
    <>
      <span ref={anchorRef} aria-hidden className="hidden" />
      {createPortal(dialogElement, portalTarget)}
    </>
  );
}
