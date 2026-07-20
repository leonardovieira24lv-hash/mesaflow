import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/api/auth";
import { getRestaurantOverview } from "@/lib/restaurant/get-restaurant-overview";
import { apiSuccess } from "@/lib/api/response";
import { handleRouteError } from "@/lib/api/errors";
import { stubResponse } from "@/lib/api/stub";

// GET /api/v1/restaurant — contrato seção 4.1
export async function GET() {
  try {
    const { profile } = await requireSession();
    const supabase = await createClient();
    const overview = await getRestaurantOverview(supabase, profile.restaurantId);

    return apiSuccess({
      id: overview.id,
      name: overview.name,
      slug: overview.slug,
      status: overview.status,
      checklist: {
        has_categories: overview.checklist.hasCategories,
        has_products: overview.checklist.hasProducts,
        qr_codes_printed: overview.checklist.qrCodesPrinted,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// PATCH /api/v1/restaurant — contrato seção 4.2
// Pertence ao módulo de Configurações (fora do escopo da Sprint 5 —
// Dashboard). Continua como stub até essa sprint.
export async function PATCH() {
  return stubResponse("PATCH /api/v1/restaurant");
}
