import { z } from "zod";
import { createHash } from "node:crypto";

/**
 * FORKO Printer — Etapa 2B (2026-08-24). Validações mínimas dos 2
 * endpoints desta etapa — mesmo padrão de `src/lib/validations/*.ts` já
 * usado no resto do projeto (schema Zod puro, sem lógica de negócio
 * dentro).
 */

/** Alfabeto do pairing code — sem caracteres ambíguos (sem `0`/`O`,
 *  `1`/`I`/`L`), pra ninguém errar digitando um código que só existe por
 *  10 minutos. 8 caracteres deste alfabeto (32 símbolos) dão ~40 bits de
 *  entropia — baixo pra um segredo permanente, aceitável aqui porque é
 *  temporário e vai estar atrás de rate limit (ver `pair/route.ts`). */
export const PAIRING_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const PAIRING_CODE_LENGTH = 8;

/** Compartilhado entre `pairing-code/route.ts` (gera+grava o hash) e
 *  `pair/route.ts` (recalcula o hash pra validar contra o que foi
 *  gravado) — uma implementação só, nunca duas concorrentes da mesma
 *  regra (mesmo raciocínio já aplicado ao snapshot de impressão, Etapa 1). */
export function hashPairingCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export const pairRequestSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .length(PAIRING_CODE_LENGTH, `Código deve ter ${PAIRING_CODE_LENGTH} caracteres.`)
    .regex(/^[A-Z0-9]+$/, "Código inválido."),
  deviceName: z.string().trim().min(1, "Nome do dispositivo é obrigatório.").max(80),
});

/**
 * Etapa 2C (2026-08-24) — POST /printer/jobs/{id}/result.
 * `retryable`/`errorCode`/`errorMessage` só fazem sentido quando
 * `status === "failed"` — a distinção sucesso/recuperável/terminal é
 * resolvida inteira dentro de `report_print_job_result()` (a RPC), este
 * schema só garante a FORMA do payload, não a regra de negócio.
 */
export const printJobResultSchema = z.object({
  status: z.enum(["printed", "failed"]),
  retryable: z.boolean().optional(),
  errorCode: z.string().trim().min(1).max(60).optional(),
  errorMessage: z.string().trim().max(500).optional(),
});
