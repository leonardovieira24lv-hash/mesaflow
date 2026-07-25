import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";
import type { RestaurantStatus } from "@/types/domain";

export interface RestaurantOverview {
  id: string;
  name: string;
  slug: string;
  status: RestaurantStatus;
  checklist: {
    hasCategories: boolean;
    hasProducts: boolean;
    qrCodesPrinted: boolean;
  };
  counts: {
    tables: number;
    categories: number;
    products: number;
  };
}

/**
 * Busca o restaurante do usuário autenticado + o estado do checklist de
 * onboarding + contadores agregados. Usada em dois lugares:
 *
 *  - `GET /api/v1/restaurant` (contrato seção 4.1) devolve só o subconjunto
 *    definido no contrato (`id`, `name`, `slug`, `status`, `checklist`).
 *  - O Dashboard (Server Component) chama isto **diretamente**, sem passar
 *    pela própria API — um Server Component fazer fetch da sua própria
 *    Route Handler é um anti-padrão no Next.js (round-trip HTTP
 *    desnecessário); ele já roda no servidor e pode reusar a mesma função.
 *    Os campos extras (`counts`) alimentam os cards de resumo do Dashboard
 *    e não fazem parte do contrato de API — são dado de exibição interno
 *    da página, não um recurso versionado.
 *
 * Todas as contagens dependem das políticas de RLS de leitura adicionadas
 * em `supabase/migrations/0004_dashboard_reads.sql`.
 */
export async function getRestaurantOverview(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Database ainda é `any` (placeholder, ver types/database.types.ts)
  supabase: SupabaseClient<any>,
  restaurantId: string,
): Promise<RestaurantOverview> {
  const [restaurantResult, categoriesResult, productsResult, tablesResult] = await Promise.all([
    supabase
      .from("restaurants")
      .select("id, name, slug, status, qr_codes_printed_at")
      .eq("id", restaurantId)
      .single(),
    supabase
      .from("menu_categories")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
    supabase.from("menu_items").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId),
    supabase.from("tables").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId),
  ]);

  if (restaurantResult.error || !restaurantResult.data) {
    throw new AppError("NOT_FOUND", "Restaurante não encontrado.");
  }

  const restaurant = restaurantResult.data;
  const categoriesCount = categoriesResult.count ?? 0;
  const productsCount = productsResult.count ?? 0;

  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    status: restaurant.status,
    checklist: {
      hasCategories: categoriesCount > 0,
      hasProducts: productsCount > 0,
      qrCodesPrinted: restaurant.qr_codes_printed_at !== null,
    },
    counts: {
      tables: tablesResult.count ?? 0,
      categories: categoriesCount,
      products: productsCount,
    },
  };
}
