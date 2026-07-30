import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { cashierListQuerySchema } from "@/lib/validations/cashier";
import { getCashierData, resolveCashierDateRange } from "@/lib/cashier/queries";

/**
 * GET /api/v1/cashier — Sprint "Painel de Caixa" (2026-07-30).
 *
 * Somente leitura. Devolve, para o intervalo pedido (`period` ou
 * `start_date`/`end_date` personalizados): os 4 indicadores do topo da
 * tela (`summary`) e a página de comandas fechadas (`sessions`) —
 * calculados sobre o mesmo recorte de dados, nunca duas consultas
 * separadas que poderiam divergir. Ver `lib/cashier/queries.ts` para a
 * lógica completa (pensada para ser reaproveitada por relatórios/exportação
 * futuros, não só por esta tela).
 */
export async function GET(request: Request) {
  try {
    const { profile } = await requireSession();
    const { searchParams } = new URL(request.url);
    const query = parseOrThrow(cashierListQuerySchema, {
      period: searchParams.get("period") ?? undefined,
      start_date: searchParams.get("start_date") ?? undefined,
      end_date: searchParams.get("end_date") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      per_page: searchParams.get("per_page") ?? undefined,
    });

    const { from, to } = resolveCashierDateRange(query.period, query.start_date, query.end_date);

    const supabase = await createClient();
    const result = await getCashierData(supabase, profile.restaurantId, {
      from,
      to,
      search: query.search,
      page: query.page,
      perPage: query.per_page,
    });

    return apiSuccess(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
