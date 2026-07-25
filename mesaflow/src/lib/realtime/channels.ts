/**
 * Nomes de canal do Supabase Realtime (contrato seção 1.10). Centralizados
 * aqui para que os Route Handlers (que disparam os eventos via escrita no
 * Postgres, publicada em `supabase/migrations/0007_orders_module.sql`) e o
 * front-end (que se inscreve nos canais — Fases 4 e 6 desta sprint) nunca
 * divirjam na convenção de nome.
 */

/** Canal administrativo — Módulo 5/7: todo pedido do restaurante, em tempo real. */
export function restaurantOrdersChannel(restaurantId: string): string {
  return `restaurant:${restaurantId}:orders`;
}

/** Canal de acompanhamento do cliente (contrato 3.4) — um único pedido específico. */
export function orderTrackingChannel(orderId: string): string {
  return `orders:id=eq.${orderId}`;
}
