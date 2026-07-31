import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface OrderTableContext {
  tableToken: string;
  isSessionOpen: boolean;
}

/**
 * Sprint "Continuar Comprando" (2026-07-31): a tela de acompanhamento
 * (contrato 3.4, `getPublicOrderStatus`) nunca precisou saber a qual mesa
 * um pedido pertence — só `id`/`status`/`items`. Passa a precisar, para
 * montar o link de volta ao cardápio (`?mesa={token}`, mesmo padrão de
 * `mesa/[token]/page.tsx`) sem exigir um novo scan do QR Code.
 *
 * Extraída como consulta própria, separada de `getPublicOrderStatus`, em
 * vez de estender a função/o endpoint existente — o contrato 3.4 continua
 * devolvendo exatamente `{id, status, items}`, sem mudança. Esta função é
 * chamada só pelo Server Component da página de acompanhamento, nunca pelo
 * *polling* (que continua batendo só no endpoint público de sempre).
 *
 * `isSessionOpen` reflete `order_sessions.closed_at is null` — mesmo
 * critério de `lib/tables/get-open-table-operations.ts` — para o botão só
 * aparecer enquanto a comanda da mesa realmente ainda está aberta. Se a
 * sessão já fechou (conta paga, mesa liberada), oferecer "continuar
 * comprando" faria `createPublicOrder` abrir uma sessão NOVA — o oposto do
 * que esta sprint pediu.
 */
export async function getOrderTableContext(
  admin: AdminClient,
  restaurantId: string,
  orderId: string,
): Promise<OrderTableContext | null> {
  const { data, error } = await admin
    .from("orders")
    .select("table:tables(qr_token), order_session:order_sessions(closed_at)")
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  // Mesmo motivo dos casts em `get-public-order-status.ts`/`active-order.ts`:
  // sem os tipos gerados do Supabase, o parsing estrutural do `select()`
  // infere as relações many-to-one como array.
  const row = data as unknown as {
    table: { qr_token: string } | null;
    order_session: { closed_at: string | null } | null;
  };

  if (!row.table) {
    return null;
  }

  return {
    tableToken: row.table.qr_token,
    isSessionOpen: row.order_session ? row.order_session.closed_at === null : false,
  };
}
