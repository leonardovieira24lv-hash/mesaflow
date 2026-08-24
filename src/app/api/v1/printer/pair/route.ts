import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiCreated } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { assertWithinRateLimit } from "@/lib/api/rate-limit";
import { pairRequestSchema, hashPairingCode } from "@/lib/validations/printer";
import { DEVICE_TOKEN_PREFIX, hashDeviceToken } from "@/lib/printing/device-auth";

/**
 * FORKO Printer — Etapa 2B (2026-08-24).
 *
 * POST /api/v1/printer/pair — sem sessão humana, de propósito (é o
 * próprio ato de "provar que você tem o código certo" que autentica).
 * Protegido por rate limit por IP (ponto 4 do pedido) — reaproveita
 * `assertWithinRateLimit`/`check_rate_limit` (migration `0040`), o
 * mesmo limitador já usado em `onboarding/restaurant/route.ts` — janela
 * deslizante, seguro em serverless (`select...for update` no Postgres,
 * não `Map` em memória, que não funcionaria com múltiplas instâncias
 * do Next.js). NENHUMA migration nova foi necessária pra isto — já
 * existia pronto no projeto.
 */

// 8 tentativas em 10 min (mesma janela do TTL do código) por IP — folga
// suficiente pra alguém errar digitando 1-2x, mas travando cedo uma
// varredura de força bruta contra o espaço de códigos possíveis.
const PAIR_RATE_LIMIT = { limit: 8, windowMs: 10 * 60_000 };

function resolveClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

function generateDeviceToken(): string {
  // 32 bytes aleatórios (pedido explícito), em hex (64 caracteres) — sem
  // preocupação de URL-encoding, já que o token só viaja dentro de um
  // header Authorization, nunca numa URL.
  return `${DEVICE_TOKEN_PREFIX}${randomBytes(32).toString("hex")}`;
}

export async function POST(request: Request) {
  try {
    await assertWithinRateLimit(`printer-pair:${resolveClientIp(request)}`, PAIR_RATE_LIMIT);

    const input = parseOrThrow(pairRequestSchema, await request.json());
    const admin = createAdminClient();

    const deviceToken = generateDeviceToken();
    const tokenHash = hashDeviceToken(deviceToken);
    const codeHash = hashPairingCode(input.code);

    const { data, error } = await admin.rpc("pair_printer_device", {
      p_code_hash: codeHash,
      p_device_name: input.deviceName,
      p_token_hash: tokenHash,
    });

    if (error) {
      // Mensagem externa deliberadamente genérica (pedido explícito do
      // dono) — não diferencia "não existe"/"expirou"/"já foi usado",
      // pra não dar pista de enumeração pra quem está tentando adivinhar.
      if (error.message.includes("INVALID_OR_EXPIRED_PAIRING_CODE")) {
        throw new AppError("UNAUTHORIZED", "Código de vinculação inválido ou expirado.");
      }
      throw new AppError("INTERNAL_ERROR", "Não foi possível parear o dispositivo. Tente novamente.");
    }

    const paired = Array.isArray(data) ? data[0] : data;
    if (!paired) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível parear o dispositivo. Tente novamente.");
    }

    // `deviceToken` em texto puro só existe aqui, nesta resposta, uma
    // única vez — nunca foi (nem será) persistido em lugar nenhum além
    // do hash já gravado por `pair_printer_device()`.
    return apiCreated({
      device: { id: paired.device_id, name: paired.name, restaurantId: paired.restaurant_id },
      deviceToken,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
