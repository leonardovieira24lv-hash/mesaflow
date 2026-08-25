import type { PaperWidth } from "../types.js";

/**
 * FORKO Printer — Etapa 5B (2026-08-24). Único lugar que sabe quantos
 * caracteres cabem numa linha, por largura de papel — pedido explícito:
 * "não espalhar 32/42/48 magic numbers pelo código".
 *
 * Valores aproximados (fonte padrão, tamanho normal) — modelos/fontes
 * diferentes podem variar um pouco na prática; isto é o ponto único de
 * ajuste futuro se um modelo específico precisar de outro valor.
 */
const CHARS_PER_LINE: Record<PaperWidth, number> = {
  58: 32,
  80: 48,
};

export function charsPerLine(paperWidth: PaperWidth): number {
  return CHARS_PER_LINE[paperWidth];
}
