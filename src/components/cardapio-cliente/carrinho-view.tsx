"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { RestaurantHeader } from "@/components/cardapio-cliente/restaurant-header";
import { CartProvider, useCart } from "@/components/cardapio-cliente/cart-context";
import { CartLineItem } from "@/components/cardapio-cliente/cart-line-item";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/format";
import { ROUTES } from "@/constants/routes";
import { withMesaQuery } from "@/lib/cliente-url";

interface CarrinhoViewProps {
  slug: string;
  tableToken: string | null;
  restaurantName: string;
}

/**
 * Página completa do carrinho (Fase 5, itens 1-7): listagem dos itens,
 * alteração de quantidade, remoção, "limpar carrinho" e resumo financeiro,
 * terminando no botão "Finalizar pedido" que leva ao Checkout. O estado em
 * si já existia desde a Fase 3 (`<CartProvider>`) — esta tela é a primeira a
 * de fato lê-lo e editá-lo por completo.
 */
export function CarrinhoView({ slug, tableToken, restaurantName }: CarrinhoViewProps) {
  return (
    <CartProvider slug={slug} tableToken={tableToken}>
      <CarrinhoContent slug={slug} tableToken={tableToken} restaurantName={restaurantName} />
    </CartProvider>
  );
}

function CarrinhoContent({ slug, tableToken, restaurantName }: CarrinhoViewProps) {
  const router = useRouter();
  const { items, subtotal, updateQuantity, removeItem, clear } = useCart();
  const [confirmingClear, setConfirmingClear] = useState(false);

  const menuHref = withMesaQuery(ROUTES.clienteMenu(slug), tableToken);

  return (
    <div className="flex min-h-screen flex-col pb-8">
      <RestaurantHeader restaurantName={restaurantName} />

      <div className="flex items-center justify-between px-4 pt-4">
        <ButtonLink href={menuHref} variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar ao cardápio
        </ButtonLink>

        {items.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmingClear(true)}
          >
            Limpar carrinho
          </Button>
        )}
      </div>

      <main className="flex flex-1 flex-col gap-4 px-4 py-4 pb-40">
        <h1 className="font-display text-xl font-semibold text-foreground">Seu carrinho</h1>

        {items.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Seu carrinho está vazio"
            description="Volte ao cardápio para adicionar produtos."
            action={<ButtonLink href={menuHref}>Ver cardápio</ButtonLink>}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <CartLineItem
                key={`${item.menuItemId}:${item.notes ?? ""}`}
                item={item}
                editable
                onUpdateQuantity={(quantity) => updateQuantity(item.menuItemId, item.notes, quantity)}
                onRemove={() => removeItem(item.menuItemId, item.notes)}
              />
            ))}
          </div>
        )}
      </main>

      {items.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md flex-col gap-3 border-t border-border bg-surface p-4 shadow-bar">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground">Total</span>
            <span className="font-mono text-lg font-semibold text-foreground">{formatCurrency(subtotal)}</span>
          </div>

          {tableToken ? (
            <Button
              size="lg"
              className="w-full"
              onClick={() => router.push(withMesaQuery(ROUTES.clienteCheckout(slug), tableToken))}
            >
              Finalizar pedido
            </Button>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Escaneie o QR Code da mesa para finalizar o pedido.
            </p>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmingClear}
        onOpenChange={setConfirmingClear}
        title="Limpar carrinho"
        description="Todos os itens serão removidos do carrinho. Esta ação não pode ser desfeita."
        variant="destructive"
        confirmLabel="Limpar"
        onConfirm={() => {
          clear();
          setConfirmingClear(false);
        }}
      />
    </div>
  );
}
