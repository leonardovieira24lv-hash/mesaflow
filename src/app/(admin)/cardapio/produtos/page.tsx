import { requirePageSession } from "@/lib/auth/require-page-session";
import { createClient } from "@/lib/supabase/server";
import { ProductsList } from "@/components/cardapio/products-list";
import type { MenuCategory, MenuItem } from "@/types/domain";

export const metadata = { title: "Produtos" };

const PER_PAGE = 20;

/**
 * Listagem/CRUD de Produtos (contrato seção 6). Carrega a primeira página +
 * a lista de categorias aqui (Server Component); toda interação seguinte
 * (filtro, paginação, criação, edição, exclusão, toggle de disponibilidade)
 * acontece no `<ProductsList>` via `/api/v1/menu/items`.
 */
export default async function ProdutosPage() {
  const { profile } = await requirePageSession();
  const supabase = await createClient();

  const [categoriesResult, itemsResult] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, name, position")
      .eq("restaurant_id", profile.restaurantId)
      .order("position", { ascending: true }),
    supabase
      .from("menu_items")
      .select("id, category_id, name, description, price, image_url, is_available", { count: "exact" })
      .eq("restaurant_id", profile.restaurantId)
      .order("name", { ascending: true })
      .range(0, PER_PAGE - 1),
  ]);

  const categories: MenuCategory[] = (categoriesResult.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    position: c.position,
  }));

  const items: MenuItem[] = (itemsResult.data ?? []).map((i) => ({
    id: i.id,
    categoryId: i.category_id,
    name: i.name,
    description: i.description ?? undefined,
    price: i.price,
    imageUrl: i.image_url ?? undefined,
    isAvailable: i.is_available,
  }));

  const total = itemsResult.count ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold">Produtos</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre os produtos do cardápio, organize por categoria e controle a disponibilidade.
        </p>
      </div>

      <ProductsList
        categories={categories}
        initialItems={items}
        initialMeta={{ page: 1, per_page: PER_PAGE, total, total_pages: Math.max(1, Math.ceil(total / PER_PAGE)) }}
      />
    </div>
  );
}
