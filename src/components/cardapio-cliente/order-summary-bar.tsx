import type { ReactNode } from "react";
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
   * `position: fixed`) — usada no Checkout (`CheckoutView`). O teclado
   * virtual em Android podia deixar um elemento `fixed` fora da área
   * realmente visível (ver histórico de correções em `checkout-view.tsx`).
   */
  mode?: "fixed" | "static";
}

/**
 * Barra de rodapé com o total do pedido e a ação principal — usada na tela
 * de Carrinho ("Finalizar pedido", `mode="fixed"`) e na de Checkout
 * ("Confirmar pedido", `mode="static"`).
 *
 * Sprint de autossuficiência visual (2026-08-08): trocado `<Button>` (que
 * estava renderizando sem nenhum estilo visível em produção, confirmado
 * por captura de tela real) por `<button>` nativo com classes Tailwind
 * diretas — fundo `emerald-500`, contraste forte, estado de loading via
 * texto simples (sem depender de spinner de nenhum componente
 * compartilhado). Nenhuma prop/lógica foi tocada.
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
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-500">Total</span>
          <span className="text-lg font-bold tabular-nums text-zinc-900">{formatCurrency(total)}</span>
        </div>

        {actionSlot ?? (
          <button
            type="button"
            onClick={onAction}
            disabled={disabled || isLoading}
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-600 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {isLoading ? "Enviando..." : actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
