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
  /**
   * "fixed" (padrão): barra fixa no rodapé da viewport — comportamento
   * original, mantido no Carrinho (`CarrinhoView`), onde não há campo de
   * texto na mesma tela.
   *
   * "static": renderizada dentro do fluxo normal da página (sem
   * `position: fixed`) — usada no Checkout (`CheckoutView`). Correção de
   * manutenção (2026-08-08): `position: fixed` é posicionado em relação à
   * viewport de *layout*, não à visual — no Chrome for Android, o teclado
   * virtual redimensiona a viewport visual sem necessariamente
   * redimensionar a de layout, deixando um elemento `fixed` fora da área
   * realmente visível enquanto o cliente digita na Observação do pedido.
   * Trocar `vh`→`dvh` (sprint anterior) não resolve esse caso específico —
   * é um mecanismo diferente do de barra de endereço aparecendo/sumindo.
   * Tirar o botão de confirmação de `fixed` no Checkout elimina o
   * problema pela raiz, sem depender de nenhum cálculo de viewport.
   */
  mode?: "fixed" | "static";
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
  mode = "fixed",
}: OrderSummaryBarProps) {
  return (
    <div
      className={cn(
        mode === "fixed"
          ? "fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-xl animate-sheet-up flex-col gap-3 p-4"
          : "flex w-full flex-col gap-3 p-4",
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
