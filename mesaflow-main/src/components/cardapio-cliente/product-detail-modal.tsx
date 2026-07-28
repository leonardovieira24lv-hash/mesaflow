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
 * volta desnecessária. Continua sendo um `<dialog>` nativo pelos mesmos
 * motivos de sempre (foco preso, Esc fecha, `::backdrop` cuida do overlay,
 * mantém a posição de scroll do cliente no cardápio) — mas, na Sprint
 * "UI Premium", deixou de reaproveitar a casca do `<Modal>` genérico
 * (o mesmo usado para confirmações administrativas) e ganhou sua própria
 * apresentação: um bottom sheet com a foto sangrando até a borda, no
 * padrão de vitrine de produto de apps de delivery — em vez de um
 * formulário centralizado com uma miniatura.
 *
 * Quantidade e observação (Módulo 2) ficam prontas aqui; "Adicionar ao
 * carrinho" já grava no `<CartProvider>` (Fase 3, item 8) — o carrinho
 * completo e a finalização (Módulos 3/4) chegam na Fase 4.
 */
export function ProductDetailModal({ item, onClose }: ProductDetailModalProps) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [imageLoaded, setImageLoaded] = useState(false);
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
        "fixed inset-x-0 bottom-0 top-auto m-0 max-h-[88vh] w-full overflow-hidden rounded-t-3xl border-t border-border bg-surface p-0 text-surface-foreground shadow-sheet",
        "sm:inset-0 sm:bottom-auto sm:m-auto sm:max-w-md sm:rounded-2xl sm:border sm:shadow-lg",
        "backdrop:bg-foreground/50 backdrop:backdrop-blur-[2px]",
        "open:animate-sheet-up sm:open:animate-scale-in",
      )}
    >
      {item && (
        <div className="flex max-h-[88vh] flex-col overflow-y-auto sm:max-h-[85vh]">
          <div className="relative h-56 w-full shrink-0 bg-muted sm:h-64 sm:rounded-t-2xl">
            {item.image_url ? (
              <>
                {!imageLoaded && <div className="skeleton-shimmer absolute inset-0 animate-shimmer" aria-hidden />}
                <Image
                  src={item.image_url}
                  alt=""
                  fill
                  sizes="448px"
                  onLoad={() => setImageLoaded(true)}
                  className={cn("object-cover transition-opacity duration-300", imageLoaded ? "opacity-100" : "opacity-0")}
                />
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <UtensilsCrossed className="h-12 w-12 text-muted-foreground" aria-hidden />
              </div>
            )}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Fechar"
              className="absolute right-3 top-3 h-9 w-9 rounded-full bg-surface/80 text-surface-foreground shadow-md backdrop-blur hover:bg-surface"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-col gap-5 px-6 pb-6 pt-5">
            <div className="flex flex-col gap-1.5">
              <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">{item.name}</h2>
              {item.description && <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>}
              <p className="pt-1 font-numeric text-lg font-bold tabular-nums text-primary">
                {formatCurrency(item.price)}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3">
              <span className="text-sm font-medium text-foreground">Quantidade</span>
              <div className="flex items-center gap-1 rounded-full bg-surface p-1 shadow-card">
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
                <span aria-live="polite" className="w-7 text-center font-numeric text-base font-semibold">
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

            <Button onClick={handleAdd} size="lg" className="w-full justify-between">
              <span>Adicionar ao carrinho</span>
              <span className="font-numeric">{formatCurrency(item.price * quantity)}</span>
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
