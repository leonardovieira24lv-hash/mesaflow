"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Minus, Plus, UtensilsCrossed, X } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useCart, type SelectedOption } from "@/components/cardapio-cliente/cart-context";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { PublicMenuItem, PublicOptionGroup } from "@/lib/orders/public-menu";

interface ProductDetailModalProps {
  item: PublicMenuItem | null;
  onClose: () => void;
}

/**
 * Detalhes do produto (Fase 3, item 7). Implementado como modal, não como
 * rota própria: o cardápio inteiro já chega numa única chamada
 * (`GET /api/v1/public/{slug}/menu`, seção 3.2) — não existe um endpoint de
 * "detalhe de um item" no contrato, então navegar para uma página separada
 * só para reexibir dados que a página do cardápio já tem seria uma ida e
 * volta desnecessária. `<dialog>` nativo pelos motivos de sempre (foco
 * preso, Esc fecha, `::backdrop` cuida do overlay, mantém a posição de
 * scroll do cliente no cardápio): bottom sheet com a foto sangrando até a
 * borda, padrão de vitrine de produto de apps de delivery.
 *
 * Quantidade e observação (Módulo 2) ficam prontas aqui; "Adicionar ao
 * carrinho" já grava no `<CartProvider>` (Fase 3, item 8).
 *
 * Sprint de manutenção (2026-08-08): `onError`/fallback na imagem; botão
 * "Adicionar ao carrinho" movido para um rodapé fixo fora da área rolável.
 *
 * Sprint de reconstrução visual (2026-08-08, seguinte): paleta padrão do
 * Tailwind, sem tokens do design system antigo.
 *
 * Sprint "Cardápio Dark/Premium" (2026-08-09): painel `zinc-900` sobre
 * overlay `black/60`, controles internos em `zinc-800`/`zinc-700` (mais
 * claros que o painel, para parecerem "elevados"/tocáveis), preço em
 * `emerald-400`, botão principal continua `emerald-500` sólido. Nenhuma
 * lógica foi tocada.
 *
 * Sprint "Identidade Forko — Cardápio Claro" (2026-08-11): painel branco
 * sobre o mesmo overlay escuro (`backdrop:bg-black/60` — continua
 * funcionando bem mesmo com painel claro, é padrão comum). Controles
 * internos viraram `zinc-100`→`branco` (a mesma lógica de "mais claro =
 * mais elevado" se inverte naturalmente: branco é o tom mais claro
 * possível, então os controles viram brancos dentro de um card cinza-claro
 * — sensação de elevação preservada). Preço em `emerald-600` (não
 * `emerald-400` — contraste ruim em fundo branco). Botão principal
 * continua `emerald-500` sólido, intocado.
 *
 * Etapa 3J — Migração para Tokens (2026-08-12): painel/textos migraram
 * pra token semântico (`bg-background`, `text-foreground`,
 * `text-muted-foreground`), caixa de quantidade virou `bg-surface`
 * (cinza, mesma hierarquia dos cards de produto), pill interna
 * `bg-background` (branca, dentro do cinza — mesma relação página/card já
 * usada em todo o Cardápio desde a Etapa 3I). Botão de fechar sobre a
 * foto (`bg-white/90`) e preço/botão principal (`emerald-600`/`emerald-500`)
 * deliberadamente preservados sem token — mesmos motivos já documentados
 * em `menu-item-card.tsx` (contraste fixo sobre foto arbitrária; cor de
 * ação, fora do escopo).
 */
export function ProductDetailModal({ item, onClose }: ProductDetailModalProps) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  // Sistema de Opcionais, Fase 1 (2026-08-14) — escolha única obrigatória
  // por grupo: `groupId -> optionId` escolhido. Um produto sem nenhum
  // `optionGroups` nunca usa isto (objeto fica vazio a vida toda).
  //
  // Sistema de Opcionais, Fase 2 (2026-08-14) — cada grupo agora guarda
  // um ARRAY de ids escolhidos, não mais 1 só: grupo `single` nunca tem
  // mais de 1 item no array (mesmo efeito de antes, só a forma mudou);
  // grupo `multiple` pode ter vários, até `maxSelections`.
  const [selectedOptionIds, setSelectedOptionIds] = useState<Record<string, string[]>>({});
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (item && !dialog.open) {
      dialog.showModal();
    } else if (!item && dialog.open) {
      dialog.close();
    }
  }, [item]);

  // Reseta quantidade/observação/opções/estado da imagem sempre que um
  // produto diferente é aberto.
  useEffect(() => {
    setQuantity(1);
    setNotes("");
    setSelectedOptionIds({});
    setImageLoaded(false);
    setHasError(false);
  }, [item?.id]);

  const optionGroups = item?.optionGroups ?? [];
  const missingRequiredGroup = optionGroups.some(
    (group) => group.required && (selectedOptionIds[group.id]?.length ?? 0) === 0,
  );

  // Preço unitário = base + soma dos `priceDelta` de TODAS as opções
  // marcadas (Fase 2: pode ser mais de uma por grupo) — recalculado a
  // cada escolha, pro cliente ver o valor final antes de adicionar
  // (nunca só descobrir no carrinho).
  const optionsPriceDelta = optionGroups.reduce((sum, group) => {
    const chosenIds = selectedOptionIds[group.id] ?? [];
    const groupDelta = chosenIds.reduce((groupSum, optionId) => {
      const option = group.options.find((o) => o.id === optionId);
      return groupSum + (option?.priceDelta ?? 0);
    }, 0);
    return sum + groupDelta;
  }, 0);
  const unitPrice = (item?.price ?? 0) + optionsPriceDelta;

  // Sistema de Opcionais, Fase 2 (2026-08-14) — grupo `single`: marcar
  // uma opção substitui a anterior (array sempre com no máximo 1). Grupo
  // `multiple`: marcar alterna (adiciona/remove), até `maxSelections` —
  // clique além do limite não faz nada (o próprio `<input>` já vem
  // `disabled` nesse caso, ver JSX abaixo; esta função é a segunda
  // camada de segurança).
  function toggleOption(group: PublicOptionGroup, optionId: string) {
    setSelectedOptionIds((prev) => {
      const current = prev[group.id] ?? [];
      if (group.selectionType !== "multiple") {
        return { ...prev, [group.id]: [optionId] };
      }
      if (current.includes(optionId)) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      if (group.maxSelections !== null && current.length >= group.maxSelections) {
        return prev;
      }
      return { ...prev, [group.id]: [...current, optionId] };
    });
  }

  function handleAdd() {
    if (!item) return;

    const selectedOptions: SelectedOption[] = optionGroups.flatMap((group) => {
      const chosenIds = selectedOptionIds[group.id] ?? [];
      return chosenIds
        .map((optionId) => group.options.find((o) => o.id === optionId))
        .filter((option): option is (typeof group.options)[number] => option !== undefined)
        .map((option) => ({
          groupId: group.id,
          groupName: group.name,
          optionId: option.id,
          optionName: option.name,
          priceDelta: option.priceDelta,
        }));
    });

    addItem({
      menuItemId: item.id,
      name: item.name,
      price: unitPrice,
      quantity,
      notes: notes.trim() || undefined,
      selectedOptions: selectedOptions.length > 0 ? selectedOptions : undefined,
      imageUrl: item.image_url ?? undefined,
    });

    toast.success("Adicionado ao carrinho", `${quantity}x ${item.name}`);
    onClose();
  }

  const showImage = Boolean(item?.image_url) && !hasError;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={item?.name}
      className={cn(
        "fixed inset-x-0 bottom-0 top-auto m-0 max-h-[88dvh] w-full overflow-hidden rounded-t-3xl border-t border-border bg-background p-0 text-foreground shadow-2xl",
        "sm:inset-0 sm:bottom-auto sm:m-auto sm:max-w-md sm:rounded-2xl sm:border sm:shadow-2xl",
        "backdrop:bg-black/60 backdrop:backdrop-blur-[2px]",
      )}
    >
      {item && (
        <div className="flex max-h-[88dvh] flex-col sm:max-h-[85dvh]">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="relative h-56 w-full shrink-0 bg-muted sm:h-64 sm:rounded-t-2xl">
              {showImage ? (
                <>
                  {!imageLoaded && <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden />}
                  <Image
                    src={item.image_url as string}
                    alt=""
                    fill
                    sizes="448px"
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setHasError(true)}
                    className={cn(
                      "object-cover transition-opacity duration-300",
                      imageLoaded ? "opacity-100" : "opacity-0",
                    )}
                  />
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <UtensilsCrossed className="h-12 w-12 text-muted-foreground" aria-hidden />
                </div>
              )}
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent"
              />
              {/* Botão fechar — HTML nativo, não depende de <Button>. */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-zinc-700 shadow-md ring-1 ring-zinc-200 transition hover:bg-white active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-5 px-6 pb-6 pt-5">
              <div className="flex flex-col gap-1.5">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">{item.name}</h2>
                {item.description && <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>}
                <p className="pt-1 text-lg font-bold tabular-nums text-soft-success-foreground">{formatCurrency(item.price)}</p>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 ring-1 ring-border">
                <span className="text-sm font-medium text-foreground">Quantidade</span>
                {/* Controles +/- — HTML nativo, área de toque 40x40, com fundo/borda/estado ativo próprios. */}
                <div className="flex items-center gap-1 rounded-full bg-background p-1 shadow-sm ring-1 ring-border">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    aria-label="Diminuir quantidade"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition hover:bg-muted active:scale-90 disabled:pointer-events-none disabled:opacity-30"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span aria-live="polite" className="w-7 text-center text-base font-semibold text-foreground">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    aria-label="Aumentar quantidade"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition hover:bg-muted active:scale-90"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Sistema de Opcionais, Fase 1 (2026-08-14) — só renderiza
                  quando o produto tem pelo menos 1 grupo aplicável (a
                  grande maioria não tem nenhum ainda).
                  Fase 2 (2026-08-14): grupo `single` continua
                  `<input type="radio">` (igual sempre foi); grupo
                  `multiple` vira `<input type="checkbox">`, com contador
                  "X/Y selecionados" no título e opções não marcadas
                  desabilitando sozinhas ao bater o limite — mesmo
                  raciocínio de "não depender de componente novo" já
                  usado no resto deste modal. */}
              {optionGroups.map((group) => {
                const chosenIds = selectedOptionIds[group.id] ?? [];
                return (
                  <div key={group.id} className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {group.name}
                      {!group.required && <span className="font-normal text-muted-foreground"> (opcional)</span>}
                      {group.selectionType === "multiple" && (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          ({chosenIds.length}/{group.maxSelections} selecionados)
                        </span>
                      )}
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {group.options.map((option) => {
                        const isChecked = chosenIds.includes(option.id);
                        const isLimitReached =
                          group.selectionType === "multiple" &&
                          !isChecked &&
                          group.maxSelections !== null &&
                          chosenIds.length >= group.maxSelections;
                        return (
                          <label
                            key={option.id}
                            className={cn(
                              "flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition",
                              isChecked ? "border-emerald-500 bg-emerald-50" : "border-border bg-background",
                              isLimitReached ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                            )}
                          >
                            <span className="flex items-center gap-2.5">
                              <input
                                type={group.selectionType === "multiple" ? "checkbox" : "radio"}
                                name={`option-group-${group.id}`}
                                checked={isChecked}
                                disabled={isLimitReached}
                                onChange={() => toggleOption(group, option.id)}
                                className="h-4 w-4 accent-emerald-500"
                              />
                              <span className="text-foreground">{option.name}</span>
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              {option.priceDelta > 0 ? `+${formatCurrency(option.priceDelta)}` : "Sem custo"}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Campo de observação — label/textarea/hint em HTML nativo, sem depender de FormField/Textarea. */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="product-notes" className="text-sm font-medium text-foreground">
                  Observação
                </label>
                <textarea
                  id="product-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Alguma observação para a cozinha?"
                  rows={2}
                  className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <p className="text-xs text-muted-foreground">Opcional — ex.: sem cebola, ponto da carne.</p>
              </div>
            </div>
          </div>

          {/* Botão principal — HTML nativo, fundo/contraste/hover/active próprios. */}
          <div className="shrink-0 border-t border-border bg-background px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <button
              type="button"
              onClick={handleAdd}
              disabled={missingRequiredGroup}
              className="flex min-h-11 w-full items-center justify-between rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-600 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            >
              <span>{missingRequiredGroup ? "Escolha as opções acima" : "Adicionar ao carrinho"}</span>
              <span className="tabular-nums">{formatCurrency(unitPrice * quantity)}</span>
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
