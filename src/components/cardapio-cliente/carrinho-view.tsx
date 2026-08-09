"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { RestaurantHeader } from "@/components/cardapio-cliente/restaurant-header";
import { CartProvider, useCart } from "@/components/cardapio-cliente/cart-context";
import { CartLineItem } from "@/components/cardapio-cliente/cart-line-item";
import { OrderSummaryBar } from "@/components/cardapio-cliente/order-summary-bar";
import { TableAssistanceActions } from "@/components/cardapio-cliente/table-assistance-actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ROUTES } from "@/constants/routes";
import { withMesaQuery } from "@/lib/cliente-url";

interface CarrinhoViewProps {
  slug: string;
  tableToken: string | null;
  restaurantName: string;
  tableName?: string;
}

/**
 * Página completa do carrinho (Fase 5, itens 1-7): listagem dos itens,
 * alteração de quantidade, remoção, "limpar carrinho" e resumo financeiro,
 * terminando no botão "Finalizar pedido" que leva ao Checkout.
 *
 * Sprint de autossuficiência visual (2026-08-08): "Voltar ao cardápio",
 * "Limpar carrinho" e o estado de carrinho vazio deixaram de depender de
 * `ButtonLink`/`Button`/`EmptyState` (estavam renderizando sem nenhum
 * estilo visível em produção, confirmado por captura de tela real) —
 * agora são HTML nativo com classes Tailwind diretas.
 *
 * Sprint "Cardápio Dark/Premium" (2026-08-09): fundo `zinc-950`, estado
 * vazio em card `zinc-900`, "Limpar carrinho" ganhou borda própria
 * (`border-red-800/50`) para não parecer texto solto.
 *
 * RISCOS AINDA NÃO RESOLVIDOS NESTE ARQUIVO — componentes importados aqui
 * cujo código-fonte eu nunca recebi, então não posso garantir (nem
 * corrigir) a aparência deles:
 * - `<ConfirmDialog>` (confirmação de "Limpar carrinho") — modal inteiro.
 * - `<CartLineItem>` (cada linha de produto do carrinho: imagem, nome,
 *   preço, +/-, remover) — é bem provável que sofra do mesmo problema dos
 *   componentes já corrigidos, mas eu não tenho o arquivo para confirmar
 *   ou consertar.
 * - `<TableAssistanceActions>` ("Chamar garçom"/"Pedir a conta").
 * Os três precisam do arquivo real para serem corrigidos com segurança.
 */
export function CarrinhoView({ slug, tableToken, restaurantName, tableName }: CarrinhoViewProps) {
  return (
    <CartProvider slug={slug} tableToken={tableToken}>
      <CarrinhoContent slug={slug} tableToken={tableToken} restaurantName={restaurantName} tableName={tableName} />
    </CartProvider>
  );
}

function CarrinhoContent({ slug, tableToken, restaurantName, tableName }: CarrinhoViewProps) {
  const router = useRouter();
  const { items, subtotal, updateQuantity, removeItem, clear } = useCart();
  const [confirmingClear, setConfirmingClear] = useState(false);

  const menuHref = withMesaQuery(ROUTES.clienteMenu(slug), tableToken);

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col bg-zinc-950 pb-8 sm:border-x sm:border-zinc-800 sm:shadow-sm">
      <RestaurantHeader restaurantName={restaurantName} tableName={tableName} />
      <TableAssistanceActions slug={slug} tableToken={tableToken} />

      <div className="flex items-center justify-between px-4 pt-4">
        <Link
          href={menuHref}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 active:scale-[0.98]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar ao cardápio
        </Link>

        {items.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmingClear(true)}
            className="rounded-lg border border-red-800/50 px-2.5 py-1.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 active:scale-[0.98]"
          >
            Limpar carrinho
          </button>
        )}
      </div>

      <main className="flex flex-1 flex-col gap-4 px-4 py-4 pb-40">
        <h1 className="text-xl font-bold tracking-tight text-white">Seu carrinho</h1>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900 px-6 py-12 text-center">
            <ShoppingBag className="h-10 w-10 text-zinc-300" aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-white">Seu carrinho está vazio</p>
              <p className="text-sm text-zinc-500">Volte ao cardápio para adicionar produtos.</p>
            </div>
            <Link
              href={menuHref}
              className="mt-1 flex min-h-11 items-center justify-center rounded-xl bg-emerald-500 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-emerald-600 active:scale-[0.98]"
            >
              Ver cardápio
            </Link>
          </div>
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
        <OrderSummaryBar
          total={subtotal}
          actionLabel="Finalizar pedido"
          onAction={() => router.push(withMesaQuery(ROUTES.clienteCheckout(slug), tableToken))}
          actionSlot={
            tableToken ? undefined : (
              <p className="text-center text-xs text-zinc-500">
                Escaneie o QR Code da mesa para finalizar o pedido.
              </p>
            )
          }
        />
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
