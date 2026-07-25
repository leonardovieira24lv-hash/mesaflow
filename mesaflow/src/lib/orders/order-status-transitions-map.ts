import type { OrderStatus } from "@/types/domain";

/**
 * Máquina de estados do pedido (contrato seção 8.3) — versão pura, sem
 * nenhuma dependência de servidor. `lib/orders/status-transitions.ts` usa
 * `AppError` (que importa `next/server`), então não pode ser importado por
 * um Client Component; esta tabela foi extraída para cá na Sprint 10
 * (auditoria de qualidade) para o Painel de Pedidos (client-side) calcular
 * as transições disponíveis de cada pedido sem duplicar esta lógica —
 * `status-transitions.ts` agora importa daqui em vez de manter sua própria
 * cópia.
 *
 * Cada chave lista os estados para os quais a transição é permitida a
 * partir dela. Estados ausentes deste objeto (`delivered`, `cancelled`) são
 * terminais — nenhuma transição é permitida a partir deles. `pending` só é
 * alcançado na criação do pedido (seção 3.3), nunca destino de uma
 * transição administrativa, mas ainda é uma origem válida aqui (o primeiro
 * avanço de status parte dele).
 */
export const ORDER_STATUS_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["delivered", "cancelled"],
};

/**
 * Estados terminais (contrato 8.3: "se o novo status for terminal, também
 * pode encerrar a order_session correspondente").
 */
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ["delivered", "cancelled"];

/** Transições permitidas a partir de `current` (lista vazia se terminal). */
export function getAvailableOrderStatusTransitions(current: OrderStatus): OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[current] ?? [];
}
