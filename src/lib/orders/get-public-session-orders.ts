import { createAdminClient } from "@/lib/supabase/admin";
import { getOrdersForSessions } from "@/lib/tables/get-open-table-operations";
import type { PublicOrderStatusItem } from "@/lib/orders/get-public-order-status";
import type { OrderStatus } from "@/types/domain";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface PublicSessionOrder {
  id: string;
  status: OrderStatus;
  items: PublicOrderStatusItem[];
  totalAmount: number;
  createdAt: string;
}

/**
 * Sprint "Evolução da Área do Cliente (Comanda)" (2026-07-31): a tela do
 * cliente passa a representar a COMANDA (todos os pedidos da mesma
 * `order_session`), não só o pedido que acabou de ser criado. Em vez de
 * escrever uma consulta nova, reaproveita `getOrdersForSessions`
 * (`lib/tables/get-open-table-operations.ts`) — a mesma função já usada
 * por `close-bill` e `tables/operations` — só filtra por
 * `order_session_id`, nunca por status, então funciona igual aqui: pedidos
 * de qualquer status entram, a sessão pode estar aberta ou já fechada
 * (comanda paga) que a lista continua correta.
 *
 * Deliberadamente NÃO reaproveita `getOpenOrderSessions` para achar a
 * sessão — aquela função só devolve sessões com `closed_at is null`, e
 * esta tela precisa continuar funcionando mesmo depois da conta fechada
 * (cliente reabre a aba de acompanhamento depois de pagar). A resolução do
 * `order_session_id` aqui é uma consulta própria, pequena, sem esse
 * filtro.
 *
 * Retorna `null` nas mesmas condições de `getPublicOrderStatus` (pedido
 * inexistente ou de outro restaurante) — mesma convenção, quem chama
 * decide como tratar (404 no endpoint, estado amigável na página).
 */
export async function getPublicSessionOrders(
  admin: AdminClient,
  restaurantId: string,
  orderId: string,
): Promise<PublicSessionOrder[] | null> {
  const { data: order, error } = await admin
    .from("orders")
    .select("order_session_id")
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error || !order || !order.order_session_id) {
    return null;
  }

  const sessionOrders = await getOrdersForSessions(admin, [order.order_session_id]);

  return sessionOrders
    .map((sessionOrder) => ({
      id: sessionOrder.id,
      status: sessionOrder.status,
      items: sessionOrder.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        notes: item.notes,
        selectedOptions: item.selected_options,
      })),
      totalAmount: sessionOrder.totalAmount,
      createdAt: sessionOrder.createdAt,
    }))
    // Mais recentes primeiro (Fase 4) — feito uma vez aqui, não em cada
    // lugar que consome a lista.
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
