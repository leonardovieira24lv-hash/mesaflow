import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { resolveRestaurantBySlug } from "@/lib/orders/resolve-public-context";
import { getPublicOrderStatus } from "@/lib/orders/get-public-order-status";

interface RouteParams {
  params: Promise<{ slug: string; orderId: string }>;
}

// GET /api/v1/public/{slug}/orders/{order_id} — contrato seção 3.4
//
// A query em si vive em `lib/orders/get-public-order-status.ts` (Fase 5:
// reaproveitada também pela Página de Acompanhamento, que faz polling deste
// mesmo serviço, sem duplicar a lógica). Resposta e comportamento
// inalterados desde a Fase 2.
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { slug, orderId } = await params;
    const admin = createAdminClient();

    const restaurant = await resolveRestaurantBySlug(admin, slug);
    const order = await getPublicOrderStatus(admin, restaurant.id, orderId);

    if (!order) {
      throw new AppError("NOT_FOUND", "Pedido não encontrado.");
    }

    return apiSuccess(order);
  } catch (err) {
    return handleRouteError(err);
  }
}
