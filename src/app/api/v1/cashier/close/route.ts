import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { closeCashierSchema } from "@/lib/validations/cashier";
import { resolveCashierDateRange } from "@/lib/cashier/queries";

// Forma da linha que `close_cashier` devolve — espelha exatamente a
// cláusula `returns table (...)` da function em
// `0024_create_close_cashier_function.sql`. Mesmo motivo do cast em
// `PATCH /api/v1/tables/{id}/close-bill`: sem os tipos gerados de verdade
// do Supabase, `.rpc()` não infere sozinho o formato de retorno de uma
// function — por isso `.returns<CloseCashierResult[]>()` abaixo.
interface CloseCashierResult {
  closing_id: string;
  revenue: number;
  closed_sessions_count: number;
  average_ticket: number;
  tables_served_count: number;
}

/**
 * POST /api/v1/cashier/close — Sprint 2 "Persistência do Fechamento de
 * Caixa" (2026-08-06).
 *
 * Mesmo padrão de `PATCH /api/v1/tables/{id}/close-bill`: endpoint fino,
 * toda a regra de negócio (recálculo dos agregados + gravação do
 * snapshot, numa única transação) vive dentro de `close_cashier`
 * (`security definer`, `0024_create_close_cashier_function.sql`). Aqui só
 * resolve a sessão — `restaurantId`/`userId` nunca vêm do body, sempre de
 * `requireSession()` — valida o formato do body e converte `period` no
 * intervalo absoluto que a function espera, reaproveitando
 * `resolveCashierDateRange` (mesma conversão que `GET /api/v1/cashier` já
 * usa), para o snapshot nunca divergir do que a tela mostrou ao usuário.
 */
export async function POST(request: Request) {
  try {
    const { userId, profile } = await requireSession();
    const body = await request.json();
    const { period, start_date, end_date, observations } = parseOrThrow(closeCashierSchema, body);

    const { from, to } = resolveCashierDateRange(period, start_date, end_date);

    const admin = createAdminClient();

    const { data, error } = await admin
      .rpc("close_cashier", {
        p_restaurant_id: profile.restaurantId,
        p_closed_by: userId,
        p_period_type: period,
        p_period_from: from,
        p_period_to: to,
        p_observations: observations ?? null,
      })
      .returns<CloseCashierResult[]>()
      .maybeSingle();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível fechar o caixa. Tente novamente.");
    }
    if (!data) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível fechar o caixa. Tente novamente.");
    }

    return apiSuccess({
      closingId: data.closing_id,
      revenue: data.revenue,
      closedSessionsCount: data.closed_sessions_count,
      averageTicket: data.average_ticket,
      tablesServedCount: data.tables_served_count,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
