import { z } from "zod";
import { AppError } from "@/lib/api/errors";
import type { TableEventStatus, TableEventType } from "@/types/domain";

/**
 * Schemas do módulo de Eventos de Mesa (docs/table-events-roadmap.md).
 * Mesmo padrão dos demais módulos (`lib/validations/orders.ts`,
 * `lib/validations/tables.ts`).
 */

export const TABLE_EVENT_TYPE_VALUES: readonly TableEventType[] = ["waiter_call", "bill_request"];

export const TABLE_EVENT_STATUS_VALUES: readonly TableEventStatus[] = ["open", "acknowledged", "resolved"];

/**
 * Valida e converte o filtro `?status=` de `GET /api/v1/tables/events`. Ao
 * contrário do filtro de pedidos (`parseOrderStatusFilter`, que aceita uma
 * lista), aqui só um único valor por vez faz sentido — a tela de Mesas
 * sempre quer só `open` (eventos que ainda pedem atenção); os outros dois
 * status existem para o histórico/depuração, não para a carga em tempo
 * real do painel.
 */
export function parseTableEventStatusFilter(raw: string | null): TableEventStatus | undefined {
  if (!raw) return undefined;

  if (!TABLE_EVENT_STATUS_VALUES.includes(raw as TableEventStatus)) {
    throw new AppError("VALIDATION_ERROR", "Filtro de status inválido.", [
      { field: "status", issue: `"${raw}" não é um status válido.` },
    ]);
  }

  return raw as TableEventStatus;
}

// Seção 2 do roadmap: só o admin avança um evento (open → acknowledged →
// resolved, ou open → resolved direto — o atendente pode resolver sem
// passar por "reconhecido"). `open` nunca é um destino válido de PATCH, é
// só o estado inicial da criação pública (mesmo raciocínio já registrado
// para `orders.status` em `lib/validations/orders.ts`).
const UPDATABLE_TABLE_EVENT_STATUS_VALUES = ["acknowledged", "resolved"] as const;

export const updateTableEventStatusSchema = z.object({
  status: z.enum(UPDATABLE_TABLE_EVENT_STATUS_VALUES, {
    invalid_type_error: "Status inválido. Use acknowledged ou resolved.",
  }),
});
export type UpdateTableEventStatusInput = z.infer<typeof updateTableEventStatusSchema>;
