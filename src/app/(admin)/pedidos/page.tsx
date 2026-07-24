import { requirePageSession } from "@/lib/auth/require-page-session";
import { createClient } from "@/lib/supabase/server";
import { OrdersList, type OrderListRow } from "@/components/pedidos/orders-list";

export const metadata = { title: "Pedidos" };

const PER_PAGE = 20;

/**
 * Painel de Pedidos em Tempo Real (contrato seção 8.1, Sprint 10).
 *
 * Era um placeholder ("Módulo a implementar") apesar do backend (seção 8,
 * Sprint 8) já estar completo — encontrado e corrigido durante a auditoria
 * de qualidade desta sprint. Carrega a primeira página aqui (Server
 * Component, mesmo padrão de `(admin)/mesas/page.tsx`) e entrega para
 * `<OrdersList>`, que cuida de filtro, paginação e das atualizações em
 * tempo real via Supabase Realtime.
 */
export default async function PedidosPage() {
  const { profile } = await requirePageSession();
  const supabase = await createClient();

  const { data, count } = await supabase
    .from("orders")
    .select("id, status, total_amount, created_at, table:tables(id, name), order_items(count)", {
      count: "exact",
    })
    .eq("restaurant_id", profile.restaurantId)
    .order("created_at", { ascending: false })
    .range(0, PER_PAGE - 1);

  // Mesmo raciocínio de cast já documentado em `api/v1/orders/route.ts`:
  // `table` (many-to-one) é inferido como array pelo parsing estrutural do
  // `.select()` do postgrest-js.
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    status: OrderListRow["status"];
    total_amount: number;
    created_at: string;
    table: { id: string; name: string } | null;
    order_items: { count: number }[] | null;
  }>;

  const orders: OrderListRow[] = rows.map((row) => ({
    id: row.id,
    table: { id: row.table?.id ?? "", name: row.table?.name ?? "—" },
    status: row.status,
    total_amount: row.total_amount,
    item_count: row.order_items?.[0]?.count ?? 0,
    created_at: row.created_at,
  }));

  const total = count ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold">Pedidos em Tempo Real</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe os pedidos das mesas e atualize o status conforme avançam na cozinha.
        </p>
      </div>

      <OrdersList
        restaurantId={profile.restaurantId}
        initialOrders={orders}
        initialMeta={{
          page: 1,
          per_page: PER_PAGE,
          total,
          total_pages: Math.max(1, Math.ceil(total / PER_PAGE)),
        }}
      />
    </div>
  );
}
