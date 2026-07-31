import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { resolveRestaurantBySlug } from "@/lib/orders/resolve-public-context";
import { getPublicSessionOrders } from "@/lib/orders/get-public-session-orders";

interface RouteParams {
  params: Promise<{ slug: string; orderId: string }>;
}

/**
 * GET /api/v1/public/{slug}/orders/{orderId}/session — Sprint "Evolução da
 * Área do Cliente (Comanda)" (2026-07-31).
 *
 * Endpoint NOVO, não uma mudança no contrato 3.4
 * (`GET /api/v1/public/{slug}/orders/{orderId}`, inalterado — continua
 * devolvendo só o pedido pedido). Sub-recurso do mesmo `orderId`: a Página
 * de Acompanhamento continua sendo aberta por `/orders/{orderId}` (Fase 3
 * do pedido — "a URL atual deve continuar funcionando"); o *polling* do
 * Client Component é que passa a bater aqui em vez do endpoint antigo,
 * pra atualizar a comanda inteira, não só um pedido.
 *
 * Mesma segurança do contrato 3.4: nenhuma autenticação, segurança pela
 * imprevisibilidade do `orderId` (UUID não sequencial) — este endpoint não
 * lista pedidos por conta própria, só resolve a comanda a partir de um
 * `orderId` que o próprio cliente já tem.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { slug, orderId } = await params;
    const admin = createAdminClient();

    const restaurant = await resolveRestaurantBySlug(admin, slug);
    const orders = await getPublicSessionOrders(admin, restaurant.id, orderId);

    if (!orders) {
      throw new AppError("NOT_FOUND", "Pedido não encontrado.");
    }

    return apiSuccess({ orders });
  } catch (err) {
    return handleRouteError(err);
  }
}
