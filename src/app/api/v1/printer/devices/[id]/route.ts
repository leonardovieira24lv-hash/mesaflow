import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/api/auth";
import { apiNoContent } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * FORKO Printer — Etapa 4 (2026-08-24).
 *
 * DELETE /api/v1/printer/devices/{id} — revoga um dispositivo do
 * restaurante do owner autenticado. Mesmo padrão de segurança de
 * `DELETE /api/v1/team/{id}`: busca o device primeiro, confirma
 * `restaurant_id` igual ao do owner ANTES de agir, `404` (não `403`) se
 * não bater — nunca confirma a existência de um `id` de outro
 * restaurante.
 *
 * `revoked_at = now()`, NUNCA um DELETE de verdade (pedido explícito:
 * "NÃO deletar histórico") — `print_jobs.claimed_by` referencia
 * `printer_devices.id` (`ON DELETE SET NULL`, migration `0054`); revogar
 * em vez de apagar preserva esse histórico de auditoria intacto, e
 * `claim_next_print_job()`/`report_print_job_result()` já checam
 * `revoked_at is null` em toda chamada — a revogação tem efeito
 * IMEDIATO na próxima tentativa do device, sem precisar de nada além
 * disto.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { profile } = await requireOwner();
    const admin = createAdminClient();

    const { data: device, error: fetchError } = await admin
      .from("printer_devices")
      .select("id, restaurant_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível desconectar o dispositivo.");
    }
    if (!device || device.restaurant_id !== profile.restaurantId) {
      throw new AppError("NOT_FOUND", "Dispositivo não encontrado.");
    }

    const { error: revokeError } = await admin
      .from("printer_devices")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);

    if (revokeError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível desconectar o dispositivo.");
    }

    return apiNoContent();
  } catch (err) {
    return handleRouteError(err);
  }
}
