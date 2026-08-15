import { notFound } from "next/navigation";
import { requirePageSession } from "@/lib/auth/require-page-session";
import { createClient } from "@/lib/supabase/server";
import { OrderDetail, type OrderDetailDto } from "@/components/pedidos/order-detail";

export const metadata = { title: "Detalhes do Pedido" };

// Mesmo cast já documentado em `api/v1/orders/[id]/route.ts`.
interface OrderRow {
  id: string;
  status: OrderDetailDto["status"];
  total_amount: number;
  notes: string | null;
  created_at: string;
  order_session_id: string | null;
  table: { id: string; name: string } | null;
  order_items:
    | {
        id: string;
        menu_item_id: string;
        name: string;
        price: number;
        quantity: number;
        notes: string | null;
        cancelled_at: string | null;
        selected_options: { group_name: string; option_name: string; price_delta: number }[] | null;
        half_and_half: { flavor_a_name: string; flavor_a_price: number; flavor_b_name: string; flavor_b_price: number } | null;
      }[]
    | null;
}

function toOrderDetailDto(row: OrderRow): OrderDetailDto {
  return {
    id: row.id,
    table: { id: row.table?.id ?? "", name: row.table?.name ?? "—" },
    status: row.status,
    total_amount: row.total_amount,
    notes: row.notes ?? undefined,
    items: (row.order_items ?? []).map((item) => ({
      id: item.id,
      menu_item_id: item.menu_item_id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      notes: item.notes ?? undefined,
      cancelled_at: item.cancelled_at,
      selected_options: item.selected_options ?? undefined,
      half_and_half: item.half_and_half ?? undefined,
    })),
    created_at: row.created_at,
  };
}

const SELECT_COLUMNS =
  "id, status, total_amount, notes, created_at, order_session_id, table:tables(id, name), order_items(id, menu_item_id, name, price, quantity, notes, cancelled_at, selected_options, half_and_half)";

/**
 * Detalhes do Pedido (contrato seção 8.2, Sprint 10) — mesmo contexto de
 * `(admin)/pedidos/page.tsx`: substitui o placeholder encontrado na
 * auditoria de qualidade, o backend já existia completo desde a Sprint 8.
 *
 * Correção (2026-08-15, relatada pelo dono com prints): esta página só
 * mostrava o pedido apontado pela URL — mas o link que leva até aqui, no
 * drawer de Mesas ("Ver histórico completo de PEDIDOS desta mesa",
 * plural), promete mostrar TODOS os pedidos da comanda. Com 2+ pedidos
 * na mesma mesa (comum: cliente pede de novo com o primeiro ainda em
 * preparo), o 2º nunca aparecia aqui — a página nunca foi feita pra
 * mostrar mais de um.
 *
 * Corrigido buscando também os "pedidos irmãos" — mesmo
 * `order_session_id` do pedido principal, todos os status, exceto ele
 * mesmo — e passando como `siblingOrders` pro componente, que os lista
 * embaixo do pedido principal (read-only: sem botão de ação, pra não
 * duplicar toda a máquina de transição de status N vezes numa página só;
 * mudar status de outro pedido continua sendo feito no drawer de Mesas
 * ou na lista de Pedidos).
 *
 * Também corrigido junto: `cancelled_at` nunca era buscado — item
 * cancelado aparecia igual a um ativo, sem risco nem rótulo "Cancelado",
 * mesmo o total (que já exclui cancelados desde a correção da migration
 * 0038) batendo diferente da soma visível dos itens — confuso.
 */
export default async function PedidoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requirePageSession();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("restaurant_id", profile.restaurantId)
    .maybeSingle();

  // RLS + filtro por restaurant_id garantem que um pedido de outro
  // restaurante nunca chega aqui — mesmo raciocínio do Route Handler
  // (`api/v1/orders/[id]/route.ts`): 404 comum, nunca revela que o recurso
  // existe para quem não tem acesso.
  if (!order) {
    notFound();
  }

  const row = order as unknown as OrderRow;
  const initialOrder = toOrderDetailDto(row);

  let siblingOrders: OrderDetailDto[] = [];
  if (row.order_session_id) {
    const { data: siblings } = await supabase
      .from("orders")
      .select(SELECT_COLUMNS)
      .eq("order_session_id", row.order_session_id)
      .eq("restaurant_id", profile.restaurantId)
      .neq("id", row.id)
      .order("created_at", { ascending: false });

    siblingOrders = ((siblings ?? []) as unknown as OrderRow[]).map(toOrderDetailDto);
  }

  return <OrderDetail initialOrder={initialOrder} siblingOrders={siblingOrders} />;
}
