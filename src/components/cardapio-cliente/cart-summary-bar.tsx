"use client";

import { ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { useCart } from "@/components/cardapio-cliente/cart-context";
import { ROUTES } from "@/constants/routes";
import { withMesaQuery } from "@/lib/cliente-url";

interface CartSummaryBarProps {
  slug: string;
}

/**
 * Resumo fixo do carrinho, no rodapé do cardápio. Até a Fase 5, o botão só
 * avisava que o carrinho estava a caminho (Fase 3, item 8: "estrutura
 * preparada"); agora que a página de Carrinho existe, ele navega de verdade
 * para lá.
 */
export function CartSummaryBar({ slug }: CartSummaryBarProps) {
  const router = useRouter();
  const { itemCount, subtotal, tableToken } = useCart();

  if (itemCount === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-border bg-surface p-4 shadow-bar">
      <Button
        size="lg"
        className="w-full justify-between"
        onClick={() => router.push(withMesaQuery(ROUTES.clienteCarrinho(slug), tableToken))}
      >
        <span className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4" aria-hidden />
          {itemCount} {itemCount === 1 ? "item" : "itens"}
        </span>
        <span className="font-mono">{formatCurrency(subtotal)}</span>
      </Button>
    </div>
  );
}
