import { notFound } from "next/navigation";
import { requirePageSession } from "@/lib/auth/require-page-session";
import { createClient } from "@/lib/supabase/server";
import { ProductDetail } from "@/components/cardapio/product-detail";
import type { MenuCategory, MenuItem } from "@/types/domain";

export const metadata = { title: "Detalhes do Produto" };

/** Edição de Produto (GET/PATCH/DELETE /api/v1/menu/items/{id} — contrato seção 6.3–6.5). */
export default async function ProdutoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requirePageSession();
  const supabase = await createClient();

  const [itemResult, categoriesResult] = await Promise.all([
    supabase
      .from("menu_items")
      .select("id, category_id, name, description, price, image_url, is_available")
      .eq("id", id)
      .eq("restaurant_id", profile.restaurantId)
      .maybeSingle(),
    supabase
      .from("menu_categories")
      .select("id, name, position")
      .eq("restaurant_id", profile.restaurantId)
      .order("position", { ascending: true }),
  ]);

  // RLS + filtro por restaurant_id garantem que um produto de outro
  // restaurante nunca aparece aqui — tratamos como 404 comum do Next.js.
  if (!itemResult.data) {
    notFound();
  }

  const item: MenuItem = {
    id: itemResult.data.id,
    categoryId: itemResult.data.category_id,
    name: itemResult.data.name,
    description: itemResult.data.description ?? undefined,
    price: itemResult.data.price,
    imageUrl: itemResult.data.image_url ?? undefined,
    isAvailable: itemResult.data.is_available,
  };

  const categories: MenuCategory[] = (categoriesResult.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    position: c.position,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold">{item.name}</h1>
        <p className="text-sm text-muted-foreground">Edite os dados do produto ou remova-o do cardápio.</p>
      </div>

      <ProductDetail item={item} categories={categories} />
    </div>
  );
}
