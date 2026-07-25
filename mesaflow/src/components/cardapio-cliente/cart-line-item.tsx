import Image from "next/image";
import { Minus, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { CartItem } from "@/components/cardapio-cliente/cart-context";

interface CartLineItemProps {
  item: CartItem;
  /** Mostra os controles de quantidade/remoção (tela de Carrinho). Sem isto, é só leitura (tela de Checkout). */
  editable?: boolean;
  onUpdateQuantity?: (quantity: number) => void;
  onRemove?: () => void;
}

/**
 * Uma linha do carrinho (Fase 5, itens 2-4: listagem, alteração de
 * quantidade, remoção). O mesmo componente serve à tela de Checkout em modo
 * somente leitura (`editable=false`), evitando duas versões quase iguais da
 * mesma lista de itens.
 *
 * Marco 2: ganhou miniatura (quando o item tem `imageUrl`) — o cliente
 * revisa o pedido reconhecendo visualmente o prato, não só pelo nome — e
 * alvos de toque de 40px nos controles de quantidade (eram 32px).
 */
export function CartLineItem({ item, editable = false, onUpdateQuantity, onRemove }: CartLineItemProps) {
  const lineTotal = item.price * item.quantity;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt="" fill sizes="56px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <UtensilsCrossed className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate font-medium text-foreground">{item.name}</p>
        {item.notes && <p className="truncate text-sm text-muted-foreground">Obs.: {item.notes}</p>}
        <span className="font-mono text-sm font-semibold tabular-nums text-primary">
          {formatCurrency(lineTotal)}
        </span>
      </div>

      {editable ? (
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-muted p-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full active:scale-90"
            onClick={() => onUpdateQuantity?.(item.quantity - 1)}
            aria-label={`Diminuir quantidade de ${item.name}`}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="w-5 text-center font-mono text-sm tabular-nums">{item.quantity}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full active:scale-90"
            onClick={() => onUpdateQuantity?.(item.quantity + 1)}
            aria-label={`Aumentar quantidade de ${item.name}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full text-muted-foreground hover:text-destructive active:scale-90"
            onClick={onRemove}
            aria-label={`Remover ${item.name} do carrinho`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 font-mono text-xs font-medium text-muted-foreground">
          Qtd. {item.quantity}
        </span>
      )}
    </div>
  );
}
