import { createAdminClient } from "@/lib/supabase/admin";
import { apiCreated } from "@/lib/api/response";
import { handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { createOrderSchema } from "@/lib/validations/orders";
import { resolveRestaurantBySlug, resolveTableByToken } from "@/lib/orders/resolve-public-context";
import { createPublicOrder } from "@/lib/orders/create-order";
import { assertWithinRateLimit } from "@/lib/api/rate-limit";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// Contrato 3.3: "protegido por rate limiting por table_token" — evita flood
// de pedidos da mesma mesa em curto intervalo. 5 pedidos por minuto é
// generoso o bastante para uso legítimo (uma mesa raramente finaliza mais de
// um pedido por minuto) e barra scripts/duplo-clique.
const ORDER_CREATION_RATE_LIMIT = { limit: 5, windowMs: 60_000 };

// POST /api/v1/public/{slug}/orders — contrato seção 3.3
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const input = parseOrThrow(createOrderSchema, body);

    assertWithinRateLimit(`create-order:${input.table_token}`, ORDER_CREATION_RATE_LIMIT);

    const admin = createAdminClient();
    const restaurant = await resolveRestaurantBySlug(admin, slug);
    const table = await resolveTableByToken(admin, restaurant.id, input.table_token);

    const order = await createPublicOrder({
      admin,
      restaurantId: restaurant.id,
      tableId: table.id,
      input,
    });

    return apiCreated({ order });
  } catch (err) {
    return handleRouteError(err);
  }
}
