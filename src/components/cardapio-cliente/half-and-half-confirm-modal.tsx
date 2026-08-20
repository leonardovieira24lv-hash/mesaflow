"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Minus, Plus, UtensilsCrossed, X } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useCart, type SelectedOption, type HalfAndHalf } from "@/components/cardapio-cliente/cart-context";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { PublicMenuItem } from "@/lib/orders/public-menu";

interface HalfAndHalfConfirmModalProps {
  /** `null` enquanto não há 2 sabores escolhidos — mesmo padrão de `item` em `ProductDetailModal` (controla show/hide do `<dialog>`). */
  flavorA: PublicMenuItem | null;
  flavorB: PublicMenuItem | null;
  onClose: () => void;
}

/**
 * Sistema de Opcionais, Fase 3 — meio a meio, Opção C (2026-08-15).
 *
 * Substitui a primeira tentativa (toggle "Fazer meio a meio?" dentro do
 * modal de UM produto) — o dono não aprovou porque escolher o 2º sabor
 * numa lista pequena, sem ver a pizza "no modo geral", não era natural.
 * Referência dada por ele (cardápio próprio que já fez antes): a escolha
 * acontece na LISTA do cardápio — toca no 1º sabor (destaca), toca no 2º
 * (ou no mesmo de nova, pra pizza inteira) — só ENTÃO abre este modal,
 * já com os dois prontos. Ver `cardapio-cliente-view.tsx` pra a lógica de
 * seleção nos cards e a barra de revisão (evita erro de toque: nada abre
 * modal sozinho, sempre passa por uma barra "Confirmar" antes).
 *
 * `flavorA` é sempre o 1º tocado, vira o `menu_item_id` principal do item
 * no pedido (mesmo raciocínio do `create-order.ts`: preço final = maior
 * dos dois, mas o FK continua sendo o 1º). Quando `flavorA.id ===
 * flavorB.id` (mesmo sabor tocado 2x), isto é uma pizza comum, inteira —
 * grava sem `halfAndHalf` nenhum, like a qualquer outro produto.
 *
 * Opcionais (ex.: Borda) usam `flavorA.optionGroups` — já inclui os da
 * categoria inteira (`public-menu.ts`), que é o que se aplica aqui
 * (borda da pizza vale pra pizza toda, não por metade).
 */
export function HalfAndHalfConfirmModal({ flavorA, flavorB, onClose }: HalfAndHalfConfirmModalProps) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [selectedOptionIds, setSelectedOptionIds] = useState<Record<string, string[]>>({});
  const ref = useRef<HTMLDialogElement>(null);

  const isOpen = Boolean(flavorA && flavorB);
  const isWholePizza = flavorA && flavorB && flavorA.id === flavorB.id;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Reseta a cada nova dupla de sabores (novo `flavorA`/`flavorB.id`) —
  // mesmo padrão de `ProductDetailModal` ao trocar de produto.
  useEffect(() => {
    setQuantity(1);
    setNotes("");
    setSelectedOptionIds({});
  }, [flavorA?.id, flavorB?.id]);

  const optionGroups = flavorA?.optionGroups ?? [];
  const missingRequiredGroup = optionGroups.some(
    (group) => group.required && (selectedOptionIds[group.id]?.length ?? 0) === 0,
  );

  const optionsPriceDelta = optionGroups.reduce((sum, group) => {
    const chosenIds = selectedOptionIds[group.id] ?? [];
    const groupDelta = chosenIds.reduce((groupSum, optionId) => {
      const option = group.options.find((o) => o.id === optionId);
      return groupSum + (option?.priceDelta ?? 0);
    }, 0);
    return sum + groupDelta;
  }, 0);
  // Regra de preço confirmada com o dono: cobra o valor do sabor MAIS
  // CARO entre os dois — nunca a média, nunca a soma.
  const basePrice = flavorA && flavorB ? Math.max(flavorA.price, flavorB.price) : 0;
  const unitPrice = basePrice + optionsPriceDelta;

  function toggleOption(group: (typeof optionGroups)[number], optionId: string) {
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
    if (!flavorA || !flavorB) return;

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

    const halfAndHalf: HalfAndHalf | undefined = isWholePizza
      ? undefined
      : {
          flavorAName: flavorA.name,
          flavorAPrice: flavorA.price,
          flavorBMenuItemId: flavorB.id,
          flavorBName: flavorB.name,
          flavorBPrice: flavorB.price,
        };

    addItem({
      menuItemId: flavorA.id,
      name: flavorA.name,
      price: unitPrice,
      quantity,
      notes: notes.trim() || undefined,
      selectedOptions: selectedOptions.length > 0 ? selectedOptions : undefined,
      halfAndHalf,
      imageUrl: flavorA.image_url ?? undefined,
    });

    toast.success(
      "Adicionado ao carrinho",
      isWholePizza ? `${quantity}x ${flavorA.name}` : `${quantity}x Meio a meio: ${flavorA.name} / ${flavorB.name}`,
    );
    onClose();
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={isWholePizza ? flavorA?.name : "Meio a meio"}
      className={cn(
        "fixed inset-x-0 bottom-0 top-auto m-0 max-h-[88dvh] w-full overflow-hidden rounded-t-3xl border-t border-border bg-background p-0 text-foreground shadow-2xl",
        "sm:inset-0 sm:bottom-auto sm:m-auto sm:max-w-md sm:rounded-2xl sm:border sm:shadow-2xl",
        "backdrop:bg-black/60 backdrop:backdrop-blur-[2px]",
      )}
    >
      {flavorA && flavorB && (
        <div className="flex max-h-[88dvh] flex-col sm:max-h-[85dvh]">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between px-6 pb-2 pt-5">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                {isWholePizza ? "Pizza inteira" : "Meio a meio"}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-muted/70"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Os 2 sabores lado a lado — "modo geral" que o dono pediu:
                foto de verdade, não só nome numa lista. Quando é pizza
                inteira, os dois lados são o mesmo sabor mesmo (repetido
                de propósito — reforça visualmente "inteira"). */}
            <div className="flex gap-3 px-6 pb-4">
              {[flavorA, flavorB].map((flavor, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="relative h-24 w-full overflow-hidden rounded-2xl bg-muted">
                    {flavor.image_url ? (
                      <Image src={flavor.image_url} alt="" fill sizes="200px" className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <UtensilsCrossed className="h-6 w-6 text-muted-foreground" aria-hidden />
                      </div>
                    )}
                  </div>
                  <span className="text-center text-sm font-semibold text-foreground">{flavor.name}</span>
                  <span className="text-xs text-muted-foreground">{formatCurrency(flavor.price)}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-5 px-6 pb-6">
              {!isWholePizza && (
                <p className="text-xs text-muted-foreground">Cobrado o valor do sabor mais caro entre os dois.</p>
              )}

              <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 ring-1 ring-border">
                <span className="text-sm font-medium text-foreground">Quantidade</span>
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
                              isChecked ? "border-emerald-500 bg-background ring-1 ring-emerald-500/70" : "border-border bg-background",
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

              <div className="flex flex-col gap-1.5">
                <label htmlFor="half-and-half-notes" className="text-sm font-medium text-foreground">
                  Observação
                </label>
                <textarea
                  id="half-and-half-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Alguma observação para a cozinha?"
                  rows={2}
                  className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>
          </div>

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
