"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Minus, Plus, UtensilsCrossed, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { useCart } from "@/components/cardapio-cliente/cart-context";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { PublicMenuItem } from "@/lib/orders/public-menu";

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
 * "Adicionar ao carrinho" movido para um rodapé fixo fora da área rolável
 * — antes era o último elemento dentro da mesma área da imagem/texto, e em
 * telas mobile mais curtas (ou com teclado aberto) podia ficar cortado.
 *
 * Sprint de reconstrução visual (2026-08-08, seguinte): reescrito para usar
 * só paleta padrão do Tailwind — fundo branco, overlay preto, textos em
 * `zinc-900`/`zinc-500`, preço em `emerald-600` — sem nenhum token do
 * design system antigo/`ds2-*`. Nenhuma lógica foi tocada.
 */
export function ProductDetailModal({ item, onClose }: ProductDetailModalProps) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
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

  // Reseta quantidade/observação/estado da imagem sempre que um produto
  // diferente é aberto.
  useEffect(() => {
    setQuantity(1);
    setNotes("");
    setImageLoaded(false);
    setHasError(false);
  }, [item?.id]);

  function handleAdd() {
    if (!item) return;

    addItem({
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      quantity,
      notes: notes.trim() || undefined,
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
        "fixed inset-x-0 bottom-0 top-auto m-0 max-h-[88dvh] w-full overflow-hidden rounded-t-3xl border-t border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl",
        "sm:inset-0 sm:bottom-auto sm:m-auto sm:max-w-md sm:rounded-2xl sm:border sm:shadow-2xl",
        "backdrop:bg-black/60 backdrop:backdrop-blur-[2px]",
      )}
    >
      {item && (
        // Botão "Adicionar ao carrinho" num rodapé fixo, fora da área
        // rolável — sempre visível, nunca depende de o cliente rolar até
        // o fim (ver docstring acima).
        <div className="flex max-h-[88dvh] flex-col sm:max-h-[85dvh]">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="relative h-56 w-full shrink-0 bg-zinc-100 sm:h-64 sm:rounded-t-2xl">
              {showImage ? (
                <>
                  {!imageLoaded && <div className="absolute inset-0 animate-pulse bg-zinc-200" aria-hidden />}
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
                  <UtensilsCrossed className="h-12 w-12 text-zinc-400" aria-hidden />
                </div>
              )}
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Fechar"
                className="absolute right-3 top-3 h-9 w-9 rounded-full bg-white/90 text-zinc-700 shadow-md backdrop-blur hover:bg-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-col gap-5 px-6 pb-6 pt-5">
              <div className="flex flex-col gap-1.5">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900">{item.name}</h2>
                {item.description && <p className="text-sm leading-relaxed text-zinc-500">{item.description}</p>}
                <p className="pt-1 text-lg font-bold tabular-nums text-emerald-600">{formatCurrency(item.price)}</p>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-zinc-100 px-4 py-3">
                <span className="text-sm font-medium text-zinc-900">Quantidade</span>
                <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-sm">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    aria-label="Diminuir quantidade"
                    className="h-8 w-8 rounded-full"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span aria-live="polite" className="w-7 text-center text-base font-semibold text-zinc-900">
                    {quantity}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setQuantity((q) => q + 1)}
                    aria-label="Aumentar quantidade"
                    className="h-8 w-8 rounded-full"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <FormField label="Observação" hint="Opcional — ex.: sem cebola, ponto da carne.">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Alguma observação para a cozinha?"
                  rows={2}
                />
              </FormField>
            </div>
          </div>

          <div className="shrink-0 border-t border-zinc-200 bg-white px-6 py-4">
            <Button onClick={handleAdd} size="lg" className="w-full justify-between">
              <span>Adicionar ao carrinho</span>
              <span className="tabular-nums">{formatCurrency(item.price * quantity)}</span>
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
