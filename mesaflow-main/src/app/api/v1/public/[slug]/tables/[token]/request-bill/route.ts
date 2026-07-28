import { createAdminClient } from "@/lib/supabase/admin";
import { apiCreated } from "@/lib/api/response";
import { handleRouteError } from "@/lib/api/errors";
import { resolveRestaurantBySlug, resolveTableByToken } from "@/lib/orders/resolve-public-context";
import { createOrReuseTableEvent } from "@/lib/table-events/create-table-event";
import { assertWithinRateLimit } from "@/lib/api/rate-limit";

interface RouteParams {
  params: Promise<{ slug: string; token: string }>;
}

// Mesmo raciocínio de limite do call-waiter (ver comentário lá).
const REQUEST_BILL_RATE_LIMIT = { limit: 10, windowMs: 5 * 60_000 };

// POST /api/v1/public/{slug}/tables/{token}/request-bill — docs/table-events-roadmap.md seção 2
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { slug, token } = await params;

    assertWithinRateLimit(`request-bill:${token}`, REQUEST_BILL_RATE_LIMIT);

    const admin = createAdminClient();
    const restaurant = await resolveRestaurantBySlug(admin, slug);
    const table = await resolveTableByToken(admin, restaurant.id, token);

    const event = await createOrReuseTableEvent(admin, restaurant.id, table.id, "bill_request");

    return apiCreated({ event });
  } catch (err) {
    return handleRouteError(err);
  }
}
