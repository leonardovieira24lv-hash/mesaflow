import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/api/errors";
import type { CreateOrderInput } from "@/lib/validations/orders";

type AdminClient = ReturnType<typeof createAdminClient>;

interface CreatePublicOrderParams {
  admin: AdminClient;
  restaurantId: string;
  tableId: string;
  input: CreateOrderInput;
}

interface CreatedOrderSummary {
  id: string;
  status: "pending";
  total_amount: number;
}

interface MenuItemRow {
  id: string;
  name: string;
  price: number;
  is_available: boolean;
}

/**
 * Cria um pedido do cliente (contrato seção 3.3), revalidando preço e
 * disponibilidade no servidor — nunca confiando no que o front-end carregou
 * antes ("no momento do envio", seção 3.3). `price`/`total_amount` são
 * sempre calculados aqui a partir de `menu_items.price` atual; o payload do
 * cliente nunca carrega preço, então não há "preço divergente" possível do
 * lado do servidor — só disponibilidade, que é o que de fato se valida.
 */
export async function createPublicOrder({
  admin,
  restaurantId,
  tableId,
  input,
}: CreatePublicOrderParams): Promise<CreatedOrderSummary> {
  const menuItemIds = [...new Set(input.items.map((item) => item.menu_item_id))];

  const { data: menuItems, error: menuItemsError } = await admin
    .from("menu_items")
    .select("id, name, price, is_available")
    .eq("restaurant_id", restaurantId)
    .in("id", menuItemIds);

  if (menuItemsError) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível validar os itens do pedido.");
  }

  const menuItemById = new Map<string, MenuItemRow>((menuItems ?? []).map((item) => [item.id, item]));

  // Contrato 3.3: cada `menu_item_id` deve existir, pertencer a este
  // restaurante e estar `is_available = true` agora — qualquer item ausente
  // ou indisponível vira `422 STALE_PRICE_OR_AVAILABILITY`, com `details`
  // listando exatamente quais (mesmo já previsto na tela de Carrinho).
  const staleDetails = input.items
    .filter((item) => {
      const menuItem = menuItemById.get(item.menu_item_id);
      return !menuItem || !menuItem.is_available;
    })
    .map((item) => ({
      field: item.menu_item_id,
      issue: menuItemById.has(item.menu_item_id)
        ? "Este item ficou indisponível."
        : "Este item não existe mais no cardápio.",
    }));

  if (staleDetails.length > 0) {
    throw new AppError(
      "STALE_PRICE_OR_AVAILABILITY",
      "Alguns itens do pedido mudaram desde que o cardápio foi carregado. Revise o carrinho.",
      staleDetails,
    );
  }

  const orderItemsToInsert = input.items.map((item) => {
    // Non-null: todo `menu_item_id` já passou pela checagem acima.
    const menuItem = menuItemById.get(item.menu_item_id)!;
    return {
      menu_item_id: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: item.quantity,
      notes: item.notes || null,
    };
  });

  const totalAmount = orderItemsToInsert.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Contrato 3.3: "order_sessions (criação, se não houver uma sessão aberta
  // para a mesa)" — reaproveita a sessão em aberto se existir, em vez de
  // sempre abrir uma nova (uma mesa pode receber vários pedidos na mesma
  // visita antes de fechar a conta — contrato 3.1: "active_order").
  const { data: openSession, error: openSessionError } = await admin
    .from("order_sessions")
    .select("id")
    .eq("table_id", tableId)
    .is("closed_at", null)
    .maybeSingle();

  if (openSessionError) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível verificar a sessão da mesa.");
  }

  let orderSessionId: string | null = openSession?.id ?? null;

  if (!orderSessionId) {
    const { data: newSession, error: newSessionError } = await admin
      .from("order_sessions")
      .insert({ restaurant_id: restaurantId, table_id: tableId })
      .select("id")
      .single();

    if (newSessionError || !newSession) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível abrir a comanda da mesa.");
    }

    orderSessionId = newSession.id;
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      restaurant_id: restaurantId,
      table_id: tableId,
      order_session_id: orderSessionId,
      status: "pending",
      total_amount: totalAmount,
      notes: input.notes || null,
    })
    .select("id, status, total_amount")
    .single();

  if (orderError || !order) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o pedido. Tente novamente.");
  }

  const { error: orderItemsError } = await admin
    .from("order_items")
    .insert(orderItemsToInsert.map((item) => ({ ...item, order_id: order.id })));

  if (orderItemsError) {
    // O cliente supabase-js não expõe transação explícita para o service
    // role fora de uma função Postgres (RPC) — melhor esforço de rollback
    // manual aqui para não deixar um pedido "fantasma" sem itens. Se isto se
    // tornar um ponto de falha recorrente em produção, vale migrar a
    // criação inteira para uma função `SECURITY DEFINER` atômica.
    await admin.from("orders").delete().eq("id", order.id);
    throw new AppError(
      "INTERNAL_ERROR",
      "Não foi possível registrar os itens do pedido. Tente novamente.",
    );
  }

  return {
    id: order.id,
    status: "pending",
    total_amount: order.total_amount,
  };
}
