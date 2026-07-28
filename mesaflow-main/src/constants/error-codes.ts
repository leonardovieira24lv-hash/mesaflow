/**
 * Catálogo fechado de códigos de erro — nunca inventar strings novas aqui fora.
 * Espelha a seção 1.5 do contrato de API (api-contracts-v1.md).
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  STALE_PRICE_OR_AVAILABILITY: "STALE_PRICE_OR_AVAILABILITY",
  INVALID_STATUS_TRANSITION: "INVALID_STATUS_TRANSITION",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Mapeamento padrão código de erro -> status HTTP (seção 1.4). Pode ser sobrescrito caso a caso. */
export const ERROR_CODE_HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  STALE_PRICE_OR_AVAILABILITY: 422,
  INVALID_STATUS_TRANSITION: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};
