"use client";

import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { RestaurantHeader } from "@/components/cardapio-cliente/restaurant-header";
import { CategoryNav, categorySectionId } from "@/components/cardapio-cliente/category-nav";
import { MenuItemCard } from "@/components/cardapio-cliente/menu-item-card";
import { ProductDetailModal } from "@/components/cardapio-cliente/product-detail-modal";
import { CartProvider } from "@/components/cardapio-cliente/cart-context";
import { CartSummaryBar } from "@/components/cardapio-cliente/cart-summary-bar";
import { EmptyState } from "@/components/ui/empty-state";
import type { PublicMenuCategory, PublicMenuItem } from "@/lib/orders/public-menu";

interface CardapioClienteViewProps {
  slug: string;
  tableToken: string | null;
  restaurantName: string;
  tableName?: string;
  categories: PublicMenuCategory[];
}

/**
 * Tela do cardápio do cliente (Fase 3 completa): cabeçalho com dados do
 * restaurante/mesa (item 2), navegação por categorias (itens 3/6),
 * listagem e organização visual dos produtos (itens 4/5) e o modal de
 * detalhes do produto (item 7). O carrinho (item 8) é só a estrutura —
 * `<CartProvider>` guarda o estado, `<CartSummaryBar>` reflete o total,
 * mas a tela de carrinho/finalização em si chega na Fase 4.
 */
export function CardapioClienteView({
  slug,
  tableToken,
  restaurantName,
  tableName,
  categories,
}: CardapioClienteViewProps) {
  const [selectedItem, setSelectedItem] = useState<PublicMenuItem | null>(null);
  const hasCategories = categories.length > 0;

  return (
    <CartProvider slug={slug} tableToken={tableToken}>
      <div className="flex min-h-screen flex-col pb-24">
        <RestaurantHeader restaurantName={restaurantName} tableName={tableName} />
        <CategoryNav categories={categories} />

        <main className="flex flex-1 flex-col gap-8 px-4 py-6">
          {!hasCategories ? (
            <EmptyState
              icon={UtensilsCrossed}
              title="Cardápio ainda não disponível"
              description="Este restaurante ainda não cadastrou categorias ou produtos."
            />
          ) : (
            categories.map((category) => (
              <section
                key={category.id}
                id={categorySectionId(category.id)}
                className="flex scroll-mt-32 flex-col gap-3"
              >
                <h2 className="font-display text-lg font-semibold text-foreground">{category.name}</h2>

                {category.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum produto nesta categoria ainda.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {category.items.map((item) => (
                      <MenuItemCard key={item.id} item={item} onSelect={setSelectedItem} />
                    ))}
                  </div>
                )}
              </section>
            ))
          )}
        </main>

        <ProductDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
        <CartSummaryBar slug={slug} />
      </div>
    </CartProvider>
  );
}
