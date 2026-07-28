import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess } from "@/lib/api/response";
import { handleRouteError } from "@/lib/api/errors";
import { resolveRestaurantBySlug, resolveTableByToken } from "@/lib/orders/resolve-public-context";
import { getActiveOrderForTable } from "@/lib/orders/active-order";

interface RouteParams {
  params: Promise<{ slug: string; token: string }>;
}

// GET /api/v1/public/{slug}/tables/{token} — contrato seção 3.1
//
// A query do pedido ativo vive em `lib/orders/active-order.ts` (Fase 3:
// reaproveitada também pela página resolvedora de mesa, sem duplicar a
// lógica) — este handler só resolve restaurante/mesa e devolve o envelope
// da API. Resposta e comportamento inalterados desde a Fase 2.
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { slug, token } = await params;
    const admin = createAdminClient();

    const restaurant = await resolveRestaurantBySlug(admin, slug);
    const table = await resolveTableByToken(admin, restaurant.id, token);
    const activeOrder = await getActiveOrderForTable(admin, table.id);

    return apiSuccess({
      restaurant: { name: restaurant.name, slug: restaurant.slug },
      table: { id: table.id, name: table.name },
      active_order: activeOrder,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
