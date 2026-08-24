import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/api/errors";

/**
 * FORKO Printer — Etapa 2B (2026-08-24). Autenticação do device via
 * `Authorization: Bearer <device-token>` — usado por esta etapa só pra
 * validar que o pareamento funciona de ponta a ponta (nenhuma rota que
 * efetivamente PRECISE disso ainda existe — `claim`/`result`/`heartbeat`
 * são etapas futuras, que vão reaproveitar este mesmo helper sem
 * modificação).
 *
 * Prefixo do token (`forko_printer_`) não é segredo — serve só pra
 * diagnóstico/reconhecimento visual (ex.: dá pra saber que uma string é
 * um token de Printer só de olhar, sem precisar decodificar nada). A
 * entropia de verdade está inteira na parte depois do prefixo.
 */
export const DEVICE_TOKEN_PREFIX = "forko_printer_";

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface AuthenticatedPrinterDevice {
  deviceId: string;
  restaurantId: string;
  name: string;
}

/**
 * Exige um device válido, não revogado, a partir do header `Authorization`
 * da requisição. Lança `AppError("UNAUTHORIZED", ...)` em qualquer caso de
 * falha — header ausente, formato errado, token não reconhecido ou device
 * revogado. Mensagem externa deliberadamente genérica ("Dispositivo não
 * autorizado.") nos 3 últimos casos — não dá pra quem está tentando saber
 * SE o token chegou a existir algum dia, só que não é válido agora.
 *
 * Comparação de segredo: não há nenhuma comparação "em memória" de token
 * bruto em lugar nenhum — a busca já é por HASH direto no banco (`eq
 * token_hash`), então não existe superfície de timing attack sobre um
 * segredo que este processo teria em mãos pra comparar byte a byte.
 */
export async function requirePrinterDevice(request: Request): Promise<AuthenticatedPrinterDevice> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError("UNAUTHORIZED", "Dispositivo não autorizado.");
  }

  const token = authHeader.slice("Bearer ".length).trim();

  if (!token.startsWith(DEVICE_TOKEN_PREFIX)) {
    throw new AppError("UNAUTHORIZED", "Dispositivo não autorizado.");
  }

  const tokenHash = hashDeviceToken(token);
  const admin = createAdminClient();

  const { data: device, error } = await admin
    .from("printer_devices")
    .select("id, restaurant_id, name, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível verificar o dispositivo. Tente novamente.");
  }

  if (!device || device.revoked_at !== null) {
    throw new AppError("UNAUTHORIZED", "Dispositivo não autorizado.");
  }

  // `last_seen_at` é só telemetria (ex.: futura UI mostrando "impressora
  // online/offline") — uma falha aqui nunca deveria derrubar a
  // autenticação em si, que já foi resolvida acima.
  const { error: touchError } = await admin
    .from("printer_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", device.id);

  if (touchError) {
    console.error("[printer-device-auth] Falha ao atualizar last_seen_at (autenticação segue válida):", touchError);
  }

  return { deviceId: device.id, restaurantId: device.restaurant_id, name: device.name };
}
