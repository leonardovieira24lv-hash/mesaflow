import type { ErrorCode } from "@/constants/error-codes";

/** Envelope de sucesso — uma entidade ou lista (contrato seção 1.3). */
export interface ApiSuccess<T> {
  data: T;
  meta?: ApiPaginationMeta;
}

export interface ApiPaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface ApiErrorDetail {
  field: string;
  issue: string;
}

/** Envelope de erro — sempre a mesma estrutura, independentemente do tipo de erro. */
export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: ApiErrorDetail[];
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
