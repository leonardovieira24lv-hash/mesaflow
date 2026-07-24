import { AppError } from "@/lib/api/errors";
import { ORDER_STATUS_TRANSITIONS, TERMINAL_ORDER_STATUSES } from "@/lib/orders/order-status-transitions-map";
import type { OrderStatus } from "@/types/domain";

export { TERMINAL_ORDER_STATUSES };

/**
 * Valida se `next` é uma transição permitida a partir de `current`. Lança
 * `422 INVALID_STATUS_TRANSITION` com `details` explicando o estado atual e
 * o solicitado (contrato seção 8.3) — a validação vive aqui, na aplicação,
 * e não numa constraint do Postgres, pelo mesmo raciocínio já registrado em
 * `supabase/migrations/0007_orders_module.sql`. A tabela de transições em
 * si vive em `lib/orders/order-status-transitions-map.ts` (Sprint 10) —
 * pura, sem `next/server`, para poder ser reaproveitada pelo Painel de
 * Pedidos (Client Component).
 */
export function assertValidOrderStatusTransition(current: OrderStatus, next: OrderStatus): void {
  const allowed = ORDER_STATUS_TRANSITIONS[current] ?? [];

  if (!allowed.includes(next)) {
    throw new AppError(
      "INVALID_STATUS_TRANSITION",
      `Não é possível mudar o pedido de "${current}" para "${next}".`,
      [{ field: "status", issue: `Transição inválida: "${current}" -> "${next}".` }],
    );
  }
}
