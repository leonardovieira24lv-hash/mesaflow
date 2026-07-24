import { Minus, Plus, Trash2 } from "lucide-react";
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
 */
export function CartLineItem({ item, editable = false, onUpdateQuantity, onRemove }: CartLineItemProps) {
  const lineTotal = item.price * item.quantity;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate font-medium text-foreground">{item.name}</p>
        {item.notes && <p className="text-sm text-muted-foreground">Obs.: {item.notes}</p>}
        <span className="font-mono text-sm font-medium text-foreground">{formatCurrency(lineTotal)}</span>
      </div>

      {editable ? (
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onUpdateQuantity?.(item.quantity - 1)}
            aria-label={`Diminuir quantidade de ${item.name}`}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="w-5 text-center font-mono text-sm">{item.quantity}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onUpdateQuantity?.(item.quantity + 1)}
            aria-label={`Aumentar quantidade de ${item.name}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            aria-label={`Remover ${item.name} do carrinho`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <span className="shrink-0 font-mono text-xs text-muted-foreground">Qtd. {item.quantity}</span>
      )}
    </div>
  );
}
