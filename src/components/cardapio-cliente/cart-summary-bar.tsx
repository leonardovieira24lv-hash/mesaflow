"use client";

import { ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import { useCart } from "@/components/cardapio-cliente/cart-context";
import { ROUTES } from "@/constants/routes";
import { withMesaQuery } from "@/lib/cliente-url";

interface CartSummaryBarProps {
  slug: string;
}

/**
 * Resumo fixo do carrinho, no rodapé do cardápio.
 *
 * Sprint "Cardápio Dark/Premium" (2026-08-09): sem mudança necessária aqui
 * — já era `bg-emerald-500` sólido, sem nenhum tom claro/branco residual.
 */
export function CartSummaryBar({ slug }: CartSummaryBarProps) {
  const router = useRouter();
  const { itemCount, subtotal, tableToken } = useCart();

  if (itemCount === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={() => router.push(withMesaQuery(ROUTES.clienteCarrinho(slug), tableToken))}
        className="flex min-h-11 w-full items-center justify-between rounded-2xl bg-emerald-500 px-5 py-3.5 font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-600 active:scale-[0.98]"
      >
        <span className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4" aria-hidden />
          {itemCount} {itemCount === 1 ? "item" : "itens"}
        </span>
        <span className="tabular-nums">{formatCurrency(subtotal)}</span>
      </button>
    </div>
  );
}
