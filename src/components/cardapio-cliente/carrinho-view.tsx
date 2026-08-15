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
import { cn } from "@/lib/utils";

interface CarrinhoViewProps {
  slug: string;
  tableToken: string | null;
  restaurantName: string;
  // Identidade — Sprint "Identidade do Restaurante no Cardápio Público"
  // (2026-08-09). Sem descrição aqui, por escopo (só o Cardápio mostra).
  restaurantLogoUrl?: string | null;
  // Etapa 2 — Propagação do Tema (2026-08-11). Mesma nota de
  // `cardapio-cliente-view.tsx`.
  menuTheme?: "light" | "dark";
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
 * Etapa 3P — Migração para Tokens (2026-08-12): este arquivo tinha ficado
 * de fora do rollout anterior (só os componentes que ele IMPORTA —
 * `<CartLineItem>`, `<OrderSummaryBar>`, `<TableAssistanceActions>` —
 * tinham sido migrados; a raiz e os botões próprios deste arquivo,
 * não). Corrigido: raiz, "Voltar ao cardápio", "Seu carrinho" e o estado
 * vazio migraram pra token. "Limpar carrinho" (vermelho) teve só o TOM do
 * texto recalibrado (`text-red-400`→`text-red-700`) — mesmo raciocínio já
 * aplicado ao verde do preço em outros arquivos, cor preservada, só mais
 * escura pra continuar legível em fundo claro.
 *
 * ACHADO PENDENTE (não corrigido aqui, precisa de decisão): `<ConfirmDialog>`
 * (confirmação de "Limpar carrinho") usa `<Modal>` (`components/ui/`), que
 * usa tokens `ds2-*` (`bg-ds2-surface`, `border-ds2-border`, etc.) — esses
 * só resolvem dentro de `.ds2-dark` (painel administrativo). Fora dali —
 * exatamente o caso do Cardápio Público — essas classes não têm variável
 * CSS definida, então o modal provavelmente renderiza sem fundo/borda/cor
 * de texto nenhum. `<Modal>` é compartilhado com o painel administrativo;
 * não alterei sem confirmar, porque mexer nele afeta os dois lugares.
 */
export function CarrinhoView({
  slug,
  tableToken,
  restaurantName,
  restaurantLogoUrl,
  menuTheme,
  tableName,
}: CarrinhoViewProps) {
  return (
    <CartProvider slug={slug} tableToken={tableToken}>
      <CarrinhoContent
        slug={slug}
        tableToken={tableToken}
        restaurantName={restaurantName}
        restaurantLogoUrl={restaurantLogoUrl}
        menuTheme={menuTheme}
        tableName={tableName}
      />
    </CartProvider>
  );
}

function CarrinhoContent({
  slug,
  tableToken,
  restaurantName,
  restaurantLogoUrl,
  menuTheme,
  tableName,
}: CarrinhoViewProps) {
  const router = useRouter();
  const { items, subtotal, updateQuantity, removeItem, clear } = useCart();
  const [confirmingClear, setConfirmingClear] = useState(false);

  const menuHref = withMesaQuery(ROUTES.clienteMenu(slug), tableToken);

  return (
    <div
      className={cn(
        "mx-auto flex min-h-dvh max-w-xl flex-col bg-background pb-8 sm:border-x sm:border-border sm:shadow-sm",
        menuTheme === "dark" && "menu-dark",
      )}
    >
      <RestaurantHeader restaurantName={restaurantName} logoUrl={restaurantLogoUrl} tableName={tableName} />
      <TableAssistanceActions slug={slug} tableToken={tableToken} />

      <div className="flex items-center justify-between px-4 pt-4">
        <Link
          href={menuHref}
          className="flex min-h-9 items-center gap-1.5 rounded-xl bg-surface px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-muted active:scale-[0.97]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar ao cardápio
        </Link>

        {items.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmingClear(true)}
            className="flex min-h-9 items-center rounded-xl bg-soft-danger px-3 py-1.5 text-sm font-semibold text-soft-danger-foreground ring-1 ring-inset ring-soft-danger-ring transition hover:bg-red-500/25 active:scale-[0.97]"
          >
            Limpar carrinho
          </button>
        )}
      </div>

      <main className="flex flex-1 flex-col gap-4 px-4 py-4 pb-40">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Seu carrinho</h1>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center elevation-card">
            <ShoppingBag className="h-10 w-10 text-muted-foreground" aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-foreground">Seu carrinho está vazio</p>
              <p className="text-sm text-muted-foreground">Volte ao cardápio para adicionar produtos.</p>
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
                onUpdateQuantity={(quantity) =>
                  updateQuantity(item.menuItemId, item.notes, item.selectedOptions, item.halfAndHalf, quantity)
                }
                onRemove={() => removeItem(item.menuItemId, item.notes, item.selectedOptions, item.halfAndHalf)}
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
              <p className="text-center text-xs text-muted-foreground">
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
