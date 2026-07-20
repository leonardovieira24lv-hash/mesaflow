import { NextResponse } from "next/server";
import { ERROR_CODE_HTTP_STATUS, type ErrorCode } from "@/constants/error-codes";
import type { ApiErrorDetail } from "@/types/api";

/**
 * Erro de aplicação padronizado. Toda falha esperada dentro de um Route
 * Handler (validação, conflito, não encontrado, etc.) deve ser lançada como
 * `AppError`, nunca como `Error` genérico — assim o handler de erro consegue
 * montar o envelope certo e o status HTTP certo automaticamente.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: ApiErrorDetail[];
  readonly status: number;

  constructor(code: ErrorCode, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
    this.status = ERROR_CODE_HTTP_STATUS[code];
  }
}

/** Monta a resposta de erro no envelope padrão (contrato seção 1.3). */
export function apiError(error: AppError) {
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    },
    { status: error.status },
  );
}

/**
 * Handler central para uso em `try/catch` dos Route Handlers. Converte
 * `AppError` no envelope certo e qualquer outro erro inesperado em
 * `500 INTERNAL_ERROR` genérico — nunca vaza stack trace ou mensagem interna
 * para o cliente (seção 1.4).
 */
export function handleRouteError(err: unknown) {
  if (err instanceof AppError) {
    return apiError(err);
  }

  console.error("[unhandled-route-error]", err);
  return apiError(new AppError("INTERNAL_ERROR", "Ocorreu um erro inesperado. Tente novamente."));
}
