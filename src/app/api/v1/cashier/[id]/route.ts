import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { getCashierSessionDetail } from "@/lib/cashier/queries";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/cashier/{id} — Sprint "Painel de Caixa" (2026-07-30).
 * Somente leitura — detalhe de uma comanda já fechada, para o modal "ao
 * tocar numa venda". Só encontra sessões com `closed_at` preenchido — uma
 * sessão ainda aberta não é uma "venda" do ponto de vista do Caixa (ela
 * aparece no Painel de Mesas, não aqui).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { profile } = await requireSession();

    const supabase = await createClient();
    const detail = await getCashierSessionDetail(supabase, profile.restaurantId, id);

    if (!detail) {
      throw new AppError("NOT_FOUND", "Venda não encontrada.");
    }

    return apiSuccess(detail);
  } catch (err) {
    return handleRouteError(err);
  }
}
