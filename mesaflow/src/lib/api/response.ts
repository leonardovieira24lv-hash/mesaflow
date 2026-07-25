import { NextResponse } from "next/server";
import type { ApiPaginationMeta } from "@/types/api";

/**
 * Monta uma resposta de sucesso no envelope padrão do contrato (seção 1.3).
 * Use sempre isto em vez de `NextResponse.json({...})` cru, para garantir que
 * todo endpoint devolve o mesmo formato.
 */
export function apiSuccess<T>(data: T, init?: { status?: number; meta?: ApiPaginationMeta }) {
  const body = init?.meta ? { data, meta: init.meta } : { data };
  return NextResponse.json(body, { status: init?.status ?? 200 });
}

/** Atalho para 201 Created (POST que cria recurso novo). */
export function apiCreated<T>(data: T) {
  return apiSuccess(data, { status: 201 });
}

/** Atalho para 204 No Content (DELETE). Nunca inclui corpo. */
export function apiNoContent() {
  return new NextResponse(null, { status: 204 });
}
