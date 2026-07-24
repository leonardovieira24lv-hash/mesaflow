import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/api/errors";
import type { OrderStatus } from "@/types/domain";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface PublicOrderStatusItem {
  name: string;
  quantity: number;
}

export interface PublicOrderStatus {
  id: string;
  status: OrderStatus;
  items: PublicOrderStatusItem[];
}

/**
 * Busca status + itens de um pedido para a Área do Cliente (contrato seção
 * 3.4). Retorna `null` quando o pedido não existe (ou não pertence a este
 * restaurante) — quem chama decide como tratar isso (o Route Handler vira
 * `404 NOT_FOUND`; a página de acompanhamento, Fase 5, mostra um estado
 * amigável).
 *
 * Extraído de dentro do Route Handler
 * (`api/v1/public/[slug]/orders/[orderId]/route.ts`) nesta fase para que a
 * página de acompanhamento reaproveite a mesma query, em vez de duplicá-la
 * — o comportamento do endpoint não mudou.
 */
export async function getPublicOrderStatus(
  admin: AdminClient,
  restaurantId: string,
  orderId: string,
): Promise<PublicOrderStatus | null> {
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (orderError) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível carregar o pedido.");
  }
  if (!order) {
    return null;
  }

  const { data: items, error: itemsError } = await admin
    .from("order_items")
    .select("name, quantity")
    .eq("order_id", order.id);

  if (itemsError) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível carregar os itens do pedido.");
  }

  return {
    id: order.id,
    status: order.status as OrderStatus,
    items: (items ?? []).map((item) => ({ name: item.name, quantity: item.quantity })),
  };
}
