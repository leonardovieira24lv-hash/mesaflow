import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleRouteError } from "@/lib/api/errors";
import { getCashierClosings } from "@/lib/cashier/queries";

/**
 * GET /api/v1/cashier/closings — histórico de fechamentos já feitos
 * (feature "Histórico de Fechamentos", 2026-08-14). Somente leitura, sem
 * filtro de período (mostra todos, paginado, mais recente primeiro) — a
 * distinção "hoje/ontem/7 dias" já fica registrada em cada linha
 * (`periodType`), não é um filtro sobre a listagem em si.
 */
export async function GET(request: Request) {
  try {
    const { profile } = await requireSession();
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const pageParam = Number(searchParams.get("page"));
    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

    const result = await getCashierClosings(supabase, profile.restaurantId, { page, perPage: 20 });

    return apiSuccess(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
