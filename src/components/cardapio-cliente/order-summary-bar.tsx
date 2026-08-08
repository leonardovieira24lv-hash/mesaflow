import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface OrderSummaryBarProps {
  total: number;
  actionLabel: string;
  onAction?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  /** Sobrescreve a ação por um conteúdo customizado (ex.: aviso "escaneie o QR Code" no lugar do botão). */
  actionSlot?: ReactNode;
  className?: string;
}

/**
 * Barra fixa de rodapé com o total do pedido e a ação principal — usada na
 * tela de Carrinho ("Finalizar pedido") e na de Checkout ("Confirmar
 * pedido").
 *
 * Marco 2: extraído a partir de duas implementações quase idênticas
 * (`CarrinhoView` e `CheckoutView` tinham cada uma sua própria barra fixa,
 * com o estilo antigo, pré-Marco 1). Essas duas telas são o mesmo tipo de
 * momento — revisar um total e confirmar uma decisão — então passam a
 * compartilhar este componente. Não inclui o `CartSummaryBar` do cardápio
 * (Marco 1): aquele é deliberadamente um botão único ("3 itens · R$ 42,00")
 * porque ali o cliente está navegando, não decidindo — juntar os três num
 * só componente forçaria um momento de navegação a parecer um momento de
 * confirmação.
 */
export function OrderSummaryBar({
  total,
  actionLabel,
  onAction,
  disabled,
  isLoading,
  actionSlot,
  className,
}: OrderSummaryBarProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-xl animate-sheet-up flex-col gap-3 p-4",
        className,
      )}
    >
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 shadow-bar">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Total</span>
          <span className="font-numeric text-lg font-bold tabular-nums text-foreground">{formatCurrency(total)}</span>
        </div>

        {actionSlot ?? (
          <Button size="lg" className="w-full" onClick={onAction} disabled={disabled} isLoading={isLoading}>
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
