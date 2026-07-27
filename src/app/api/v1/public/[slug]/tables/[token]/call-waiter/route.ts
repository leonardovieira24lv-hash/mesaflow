import { createAdminClient } from "@/lib/supabase/admin";
import { apiCreated } from "@/lib/api/response";
import { handleRouteError } from "@/lib/api/errors";
import { resolveRestaurantBySlug, resolveTableByToken } from "@/lib/orders/resolve-public-context";
import { createOrReuseTableEvent } from "@/lib/table-events/create-table-event";
import { assertWithinRateLimit } from "@/lib/api/rate-limit";

interface RouteParams {
  params: Promise<{ slug: string; token: string }>;
}

// Generoso o bastante para uso legítimo (ninguém chama o garçom 10x por
// minuto de propósito) e barra scripts/duplo-clique nervoso — mesma ordem
// de grandeza do limite de criação de pedido (`orders/route.ts`), mas com
// janela maior porque "chamar de novo" é um comportamento real (garçom
// demorou) que a criação de pedido não tem.
const CALL_WAITER_RATE_LIMIT = { limit: 10, windowMs: 5 * 60_000 };

// POST /api/v1/public/{slug}/tables/{token}/call-waiter — docs/table-events-roadmap.md seção 2
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { slug, token } = await params;

    assertWithinRateLimit(`call-waiter:${token}`, CALL_WAITER_RATE_LIMIT);

    const admin = createAdminClient();
    const restaurant = await resolveRestaurantBySlug(admin, slug);
    const table = await resolveTableByToken(admin, restaurant.id, token);

    const event = await createOrReuseTableEvent(admin, restaurant.id, table.id, "waiter_call");

    return apiCreated({ event });
  } catch (err) {
    return handleRouteError(err);
  }
}
