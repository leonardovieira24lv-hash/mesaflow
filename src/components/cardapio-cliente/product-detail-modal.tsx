"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Minus, Plus, UtensilsCrossed } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { useCart } from "@/components/cardapio-cliente/cart-context";
import { toast } from "@/components/ui/toast";
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
 * volta desnecessária. Um modal mantém a posição de scroll do cliente no
 * cardápio, o que é melhor experiência num fluxo pensado para o celular.
 *
 * Quantidade e observação (Módulo 2) ficam prontas aqui; "Adicionar ao
 * carrinho" já grava no `<CartProvider>` (Fase 3, item 8) — o carrinho
 * completo e a finalização (Módulos 3/4) chegam na Fase 4.
 */
export function ProductDetailModal({ item, onClose }: ProductDetailModalProps) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  // Reseta quantidade/observação sempre que um produto diferente é aberto.
  useEffect(() => {
    setQuantity(1);
    setNotes("");
  }, [item?.id]);

  if (!item) return null;

  function handleAdd() {
    if (!item) return;

    addItem({
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      quantity,
      notes: notes.trim() || undefined,
    });

    toast.success("Adicionado ao carrinho", `${quantity}x ${item.name}`);
    onClose();
  }

  return (
    <Modal open={Boolean(item)} onClose={onClose} title={item.name}>
      <div className="flex flex-col gap-4 pb-6">
        <div className="relative h-40 w-full overflow-hidden rounded-md bg-muted">
          {item.image_url ? (
            <Image src={item.image_url} alt="" fill sizes="448px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <UtensilsCrossed className="h-10 w-10 text-muted-foreground" aria-hidden />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
          <p className="font-mono text-base font-medium text-foreground">{formatCurrency(item.price)}</p>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Quantidade</span>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Diminuir quantidade"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span aria-live="polite" className="w-6 text-center font-mono text-base">
              {quantity}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setQuantity((q) => q + 1)}
              aria-label="Aumentar quantidade"
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
          <span className="font-mono">{formatCurrency(item.price * quantity)}</span>
        </Button>
      </div>
    </Modal>
  );
}
