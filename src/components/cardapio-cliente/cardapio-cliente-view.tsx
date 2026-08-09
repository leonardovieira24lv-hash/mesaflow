"use client";

import { useMemo, useState } from "react";
import { SearchX, UtensilsCrossed } from "lucide-react";
import { RestaurantHeader } from "@/components/cardapio-cliente/restaurant-header";
import { CategoryNav, categorySectionId } from "@/components/cardapio-cliente/category-nav";
import { MenuItemCard } from "@/components/cardapio-cliente/menu-item-card";
import { ProductDetailModal } from "@/components/cardapio-cliente/product-detail-modal";
import { CartProvider } from "@/components/cardapio-cliente/cart-context";
import { CartSummaryBar } from "@/components/cardapio-cliente/cart-summary-bar";
import { TableAssistanceActions } from "@/components/cardapio-cliente/table-assistance-actions";
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
 *
 * Busca do cabeçalho filtra `categories` inteiramente no cliente (nome +
 * descrição, sem acento/caixa) — é estado local deste componente, nenhuma
 * chamada nova de API, hook compartilhado, contexto global ou tipagem
 * alterada. Categorias sem nenhum resultado após o filtro somem da tela;
 * a barra de categorias usa sempre a lista completa (não teria sentido
 * "pular" para uma categoria que a busca escondeu).
 *
 * Sprint de reconstrução visual (2026-08-08): reescrito para usar só
 * paleta padrão do Tailwind (fundo `zinc-50`, cards brancos, texto
 * `zinc-900`), sem nenhum token do design system antigo nem `ds2-*`.
 * Busca, categorias, listagem e todo o resto da estrutura/lógica
 * continuam exatamente iguais — só `className` mudou.
 *
 * Sprint de autossuficiência visual (2026-08-08, seguinte): os dois
 * estados vazios deixaram de depender de `<EmptyState>` (estava
 * renderizando sem nenhum estilo visível em produção, confirmado por
 * captura de tela real) — agora são HTML nativo com classes Tailwind
 * diretas.
 */
export function CardapioClienteView({
  slug,
  tableToken,
  restaurantName,
  tableName,
  categories,
}: CardapioClienteViewProps) {
  const [selectedItem, setSelectedItem] = useState<PublicMenuItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const hasCategories = categories.length > 0;

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase("pt-BR");

  const visibleCategories = useMemo(() => {
    if (!normalizedSearch) return categories;

    return categories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => {
          const haystack = `${item.name} ${item.description ?? ""}`.toLocaleLowerCase("pt-BR");
          return haystack.includes(normalizedSearch);
        }),
      }))
      .filter((category) => category.items.length > 0);
  }, [categories, normalizedSearch]);

  const hasResults = visibleCategories.length > 0;

  return (
    <CartProvider slug={slug} tableToken={tableToken}>
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col bg-zinc-50 pb-24 sm:border-x sm:border-zinc-200 sm:shadow-sm">
        <RestaurantHeader
          restaurantName={restaurantName}
          tableName={tableName}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
        <TableAssistanceActions slug={slug} tableToken={tableToken} />
        <CategoryNav categories={categories} />

        <main className="flex flex-1 flex-col gap-7 px-4 py-5">
          {!hasCategories ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center">
              <UtensilsCrossed className="h-10 w-10 text-zinc-300" aria-hidden />
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-zinc-900">Cardápio ainda não disponível</p>
                <p className="text-sm text-zinc-500">Este restaurante ainda não cadastrou categorias ou produtos.</p>
              </div>
            </div>
          ) : !hasResults ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center">
              <SearchX className="h-10 w-10 text-zinc-300" aria-hidden />
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-zinc-900">Nenhum produto encontrado</p>
                <p className="text-sm text-zinc-500">
                  Não encontramos nada para &quot;{searchTerm.trim()}&quot;. Tente buscar por outro termo.
                </p>
              </div>
            </div>
          ) : (
            visibleCategories.map((category) => (
              <section
                key={category.id}
                id={categorySectionId(category.id)}
                className="flex scroll-mt-16 flex-col gap-3"
              >
                <h2 className="text-base font-bold tracking-tight text-zinc-900">{category.name}</h2>

                <div className="flex flex-col gap-3.5">
                  {category.items.map((item) => (
                    <MenuItemCard key={item.id} item={item} onSelect={setSelectedItem} />
                  ))}
                </div>
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
