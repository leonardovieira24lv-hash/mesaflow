import { notFound } from "next/navigation";
import { requirePageSession } from "@/lib/auth/require-page-session";
import { createClient } from "@/lib/supabase/server";
import { OrderDetail, type OrderDetailDto } from "@/components/pedidos/order-detail";

export const metadata = { title: "Detalhes do Pedido" };

/**
 * Detalhes do Pedido (contrato seção 8.2, Sprint 10) — mesmo contexto de
 * `(admin)/pedidos/page.tsx`: substitui o placeholder encontrado na
 * auditoria de qualidade, o backend já existia completo desde a Sprint 8.
 */
export default async function PedidoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requirePageSession();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, status, total_amount, notes, created_at, table:tables(id, name), order_items(id, menu_item_id, name, price, quantity, notes)",
    )
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

  // Mesmo cast já documentado em `api/v1/orders/[id]/route.ts`.
  const row = order as unknown as {
    id: string;
    status: OrderDetailDto["status"];
    total_amount: number;
    notes: string | null;
    created_at: string;
    table: { id: string; name: string } | null;
    order_items:
      | { id: string; menu_item_id: string; name: string; price: number; quantity: number; notes: string | null }[]
      | null;
  };

  const initialOrder: OrderDetailDto = {
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
    })),
    created_at: row.created_at,
  };

  return <OrderDetail initialOrder={initialOrder} />;
}
