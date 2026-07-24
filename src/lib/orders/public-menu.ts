import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/api/errors";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface PublicMenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available: boolean;
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  items: PublicMenuItem[];
}

interface MenuItemRow {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
}

/**
 * Monta o cardápio público (contrato seção 3.2): categorias ordenadas por
 * `position`, cada uma com seus produtos ordenados por nome. Produtos
 * indisponíveis nunca são filtrados aqui — Módulo 1: "produtos
 * indisponíveis devem aparecer desabilitados", quem decide a apresentação é
 * a UI (Fase 3), não o backend.
 *
 * Extraído de dentro do Route Handler (`api/v1/public/[slug]/menu/route.ts`)
 * nesta fase para que a Página do Cardápio (Server Component, mesmo padrão
 * já usado em todo o painel administrativo — ex.:
 * `app/(admin)/cardapio/produtos/page.tsx`, que consulta o Supabase
 * diretamente em vez de chamar sua própria API) reaproveite exatamente a
 * mesma query, em vez de duplicá-la. O comportamento e a resposta do
 * endpoint HTTP não mudaram — só a implementação interna foi movida para cá.
 */
export async function getPublicMenu(
  admin: AdminClient,
  restaurantId: string,
): Promise<PublicMenuCategory[]> {
  const [categoriesResult, itemsResult] = await Promise.all([
    admin
      .from("menu_categories")
      .select("id, name, position")
      .eq("restaurant_id", restaurantId)
      .order("position", { ascending: true }),
    admin
      .from("menu_items")
      .select("id, category_id, name, description, price, image_url, is_available")
      .eq("restaurant_id", restaurantId)
      .order("name", { ascending: true }),
  ]);

  if (categoriesResult.error || itemsResult.error) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível carregar o cardápio.");
  }

  const itemsByCategory = new Map<string, MenuItemRow[]>();
  for (const item of (itemsResult.data ?? []) as MenuItemRow[]) {
    const bucket = itemsByCategory.get(item.category_id) ?? [];
    bucket.push(item);
    itemsByCategory.set(item.category_id, bucket);
  }

  return (categoriesResult.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    items: (itemsByCategory.get(category.id) ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description ?? undefined,
      price: item.price,
      image_url: item.image_url ?? undefined,
      is_available: item.is_available,
    })),
  }));
}
