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
   * Tirar o botão de confirmação de `fixed` no Checkout elimina o
   * problema pela raiz, sem depender de nenhum cálculo de viewport.
   */
  mode?: "fixed" | "static";
}

/**
 * Barra de rodapé com o total do pedido e a ação principal — usada na tela
 * de Carrinho ("Finalizar pedido", `mode="fixed"`) e na de Checkout
 * ("Confirmar pedido", `mode="static"`).
 *
 * Sprint de reconstrução visual (2026-08-08): reescrito para usar só
 * paleta padrão do Tailwind (card branco, borda `zinc-200`), sem nenhum
 * token do design system antigo. Nenhuma lógica/prop foi tocada.
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
          ? "fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-xl flex-col gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          : "flex w-full flex-col gap-3 p-4",
        className,
      )}
    >
      <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-500">Total</span>
          <span className="text-lg font-bold tabular-nums text-zinc-900">{formatCurrency(total)}</span>
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
