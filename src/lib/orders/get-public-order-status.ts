import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/api/errors";
import type { OrderStatus } from "@/types/domain";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface PublicOrderStatusItem {
  name: string;
  quantity: number;
  // Correção (2026-08-12): observação por item ("sem cebola", etc.) nunca
  // chegava até a Área do Cliente — a consulta de origem
  // (`getOrdersForSessions`) não buscava a coluna. Cliente confirmava o
  // pedido, a cozinha recebia certo, mas o cliente não tinha como saber
  // que a observação realmente foi registrada — podia gerar chamada de
  // garçom desnecessária. `null` quando o item não tem observação.
  notes: string | null;
  // Sistema de Opcionais, Fase 1, Passo 4 (2026-08-14) — escolhas feitas
  // pelo cliente (ex.: Borda: Catupiry), resolvidas no servidor.
  selectedOptions: { group_name: string; option_name: string; price_delta: number }[] | null;
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
    .select("name, quantity, notes, selected_options")
    .eq("order_id", order.id);

  if (itemsError) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível carregar os itens do pedido.");
  }

  return {
    id: order.id,
    status: order.status as OrderStatus,
    items: (items ?? []).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      notes: item.notes,
      selectedOptions: item.selected_options,
    })),
  };
}
