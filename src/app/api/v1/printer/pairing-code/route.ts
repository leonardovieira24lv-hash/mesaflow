import { randomBytes } from "node:crypto";
import { requireOwner } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiCreated } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { PAIRING_CODE_ALPHABET, PAIRING_CODE_LENGTH, hashPairingCode } from "@/lib/validations/printer";

/**
 * FORKO Printer — Etapa 2B (2026-08-24).
 *
 * POST /api/v1/printer/pairing-code — gera um código de vinculação novo
 * pro restaurante do owner autenticado. Sem corpo de requisição (nada a
 * validar via Zod aqui — a ação inteira é "gere um código pra mim").
 *
 * Sem rate limit nesta rota, de propósito: já exige `requireOwner()` —
 * uma sessão humana autenticada e dona do restaurante já é uma barreira
 * forte por si só. O rate limit pedido explicitamente pelo dono é pro
 * endpoint público `/pair` (sem sessão nenhuma), não este.
 */

const PAIRING_CODE_TTL_MS = 10 * 60_000; // 10 minutos

function generatePairingCode(): string {
  const bytes = randomBytes(PAIRING_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
    code += PAIRING_CODE_ALPHABET[bytes[i]! % PAIRING_CODE_ALPHABET.length];
  }
  return code;
}

export async function POST() {
  try {
    const { profile } = await requireOwner();
    const admin = createAdminClient();

    // Invalida qualquer código anterior não usado deste restaurante —
    // reaproveita o mesmo campo `used_at` (marcá-lo agora tem exatamente
    // o mesmo efeito de "não pode mais ser usado" que `pair_printer_device()`
    // já checa, sem precisar de uma coluna nova só pra isso).
    const { error: invalidateError } = await admin
      .from("printer_pairing_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("restaurant_id", profile.restaurantId)
      .is("used_at", null);

    if (invalidateError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível gerar o código de vinculação. Tente novamente.");
    }

    const code = generatePairingCode();
    const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS).toISOString();

    const { error: insertError } = await admin.from("printer_pairing_codes").insert({
      restaurant_id: profile.restaurantId,
      code_hash: hashPairingCode(code),
      expires_at: expiresAt,
    });

    if (insertError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível gerar o código de vinculação. Tente novamente.");
    }

    // O código em texto puro só existe aqui, nesta resposta, uma única
    // vez — o banco nunca guarda nada além do hash (ver migration 0054 e
    // `pair_printer_device()`).
    return apiCreated({ code, expiresAt });
  } catch (err) {
    return handleRouteError(err);
  }
}
