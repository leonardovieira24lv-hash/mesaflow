import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess } from "@/lib/api/response";
import { handleRouteError } from "@/lib/api/errors";
import { resolveRestaurantBySlug } from "@/lib/orders/resolve-public-context";
import { getPublicMenu } from "@/lib/orders/public-menu";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// GET /api/v1/public/{slug}/menu — contrato seção 3.2
//
// A query em si vive em `lib/orders/public-menu.ts` (Fase 3: reaproveitada
// também pela Página do Cardápio, Server Component, sem duplicar a lógica) —
// este handler só resolve o restaurante e devolve o envelope da API. Resposta
// e comportamento inalterados desde a Fase 2.
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const admin = createAdminClient();

    const restaurant = await resolveRestaurantBySlug(admin, slug);
    const categories = await getPublicMenu(admin, restaurant.id);

    return apiSuccess({ categories });
  } catch (err) {
    return handleRouteError(err);
  }
}
