import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";

/**
 * FORKO Printer — Etapa 4 (2026-08-24).
 *
 * GET /api/v1/printer/devices — lista os dispositivos (`printer_devices`)
 * do restaurante do owner autenticado. Mesmo molde de `GET /api/v1/team`
 * (`requireOwner()`, `createAdminClient()`, `apiSuccess`).
 *
 * Resposta enxuta de propósito (pedido explícito: "nunca retornar
 * token_hash") — só o que a UI de produto precisa: nome, quando foi
 * visto por último, quando foi criado, e se está revogado. Nunca
 * `token_hash` nem qualquer detalhe interno de auth.
 */
export async function GET() {
  try {
    const { profile } = await requireOwner();
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("printer_devices")
      .select("id, name, last_seen_at, created_at, revoked_at")
      .eq("restaurant_id", profile.restaurantId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível carregar os dispositivos.");
    }

    return apiSuccess(
      (data ?? []).map((device) => ({
        id: device.id,
        name: device.name,
        lastSeenAt: device.last_seen_at,
        createdAt: device.created_at,
        revokedAt: device.revoked_at,
      })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
