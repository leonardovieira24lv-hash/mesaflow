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

/**
 * Canal administrativo — Painel de Mesas: mudanças de status de mesa em
 * tempo real (Sprint 2 de Correção, Fase de Estabilização). Antes desta
 * sprint, `tables` não era publicada no Realtime — uma mesa aberta/liberada
 * num dispositivo só aparecia atualizada em outro depois de recarregar a
 * página. Canal próprio (em vez de reaproveitar o de pedidos) porque o
 * evento é sobre a mesa em si, não sobre um pedido.
 */
export function restaurantTablesChannel(restaurantId: string): string {
  return `restaurant:${restaurantId}:tables`;
}

/** Canal de acompanhamento do cliente (contrato 3.4) — um único pedido específico. */
export function orderTrackingChannel(orderId: string): string {
  return `orders:id=eq.${orderId}`;
}
