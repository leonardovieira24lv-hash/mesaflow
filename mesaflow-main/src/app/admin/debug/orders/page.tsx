import { requirePageSession } from "@/lib/auth/require-page-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDebugEnvironmentInfo } from "@/lib/debug/environment";
import { OrdersDebugClient, type OrderDebugRow } from "@/components/debug/orders-debug-client";

export const metadata = { title: "Debug Tools — Orders" };
export const dynamic = "force-dynamic";

/**
 * Debug Tools / Orders — ferramenta permanente de desenvolvimento (não é
 * uma tela do produto). Criada originalmente para investigar um pedido
 * travado em "pending" com falso conflito em toda ação; promovida a
 * ferramenta fixa do módulo `/admin/debug/*` para acelerar diagnósticos
 * futuros, já que o projeto é desenvolvido predominantemente pelo celular
 * (sem acesso rápido ao SQL Editor do Supabase).
 *
 * Somente leitura: nenhum `insert`/`update`/`delete` em lugar nenhum deste
 * arquivo ou do Client Component que ele renderiza.
 *
 * Usa o cliente admin (service role) de propósito, para ver o dado bruto
 * do Postgres sem RLS filtrando nada — é assim que uma divergência de
 * `restaurant_id` entre pedido/mesa/sessão fica visível.
 */

interface TableRow {
  id: string;
  restaurant_id: string;
  name: string;
  status: string;
}
interface OrderSessionRow {
  id: string;
  restaurant_id: string;
  table_id: string;
  opened_at: string;
  closed_at: string | null;
}
interface ActiveOrderRow {
  id: string;
  table_id: string;
  status: string;
  restaurant_id: string;
  created_at: string;
}
interface RawOrderRow {
  id: string;
  restaurant_id: string;
  table_id: string;
  order_session_id: string | null;
  status: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export default async function DebugOrdersPage() {
  const { profile } = await requirePageSession();
  const admin = createAdminClient();
  const env = getDebugEnvironmentInfo();

  const { data: ordersRaw } = await admin
    .from("orders")
    .select("id, restaurant_id, table_id, order_session_id, status, total_amount, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(20);
  const orders = (ordersRaw ?? []) as RawOrderRow[];

  const tableIds = [...new Set(orders.map((o) => o.table_id))];
  const sessionIds = [...new Set(orders.map((o) => o.order_session_id).filter((id): id is string => Boolean(id)))];
  const restaurantIds = [...new Set(orders.map((o) => o.restaurant_id))];

  const { data: tablesRaw } = await admin
    .from("tables")
    .select("id, restaurant_id, name, status")
    .in("id", tableIds.length > 0 ? tableIds : ["00000000-0000-0000-0000-000000000000"]);
  const tables = (tablesRaw ?? []) as TableRow[];

  const { data: sessionsRaw } = await admin
    .from("order_sessions")
    .select("id, restaurant_id, table_id, opened_at, closed_at")
    .in("id", sessionIds.length > 0 ? sessionIds : ["00000000-0000-0000-0000-000000000000"]);
  const sessions = (sessionsRaw ?? []) as OrderSessionRow[];

  const { data: existingRestaurantsRaw } = await admin
    .from("restaurants")
    .select("id")
    .in("id", restaurantIds.length > 0 ? restaurantIds : ["00000000-0000-0000-0000-000000000000"]);
  const existingRestaurantIds = new Set((existingRestaurantsRaw ?? []).map((r) => (r as { id: string }).id));

  // Todos os pedidos ainda não-terminais de QUALQUER restaurante — usado
  // pra contar "pedidos ativos na mesma mesa" e detectar sessão duplicada.
  const { data: allActiveOrdersRaw } = await admin
    .from("orders")
    .select("id, table_id, status, restaurant_id, created_at")
    .not("status", "in", "(delivered,cancelled)");
  const allActiveOrders = (allActiveOrdersRaw ?? []) as ActiveOrderRow[];

  const tableById = new Map<string, TableRow>(tables.map((t) => [t.id, t]));
  const sessionById = new Map<string, OrderSessionRow>(sessions.map((s) => [s.id, s]));

  const rows: OrderDebugRow[] = orders.map((o) => {
    const table = o.table_id ? tableById.get(o.table_id) ?? null : null;
    const session = o.order_session_id ? sessionById.get(o.order_session_id) ?? null : null;
    const activeOrdersOnSameTable = allActiveOrders.filter((a) => a.table_id === o.table_id);
    const restaurantExists = existingRestaurantIds.has(o.restaurant_id);

    const inconsistencies: string[] = [];
    if (!table) inconsistencies.push("mesa inexistente (table_id órfão)");
    if (o.order_session_id && !session) inconsistencies.push("sessão inexistente (order_session_id órfão)");
    if (table && table.restaurant_id !== o.restaurant_id) inconsistencies.push("restaurant_id diferente da mesa");
    if (session && session.restaurant_id !== o.restaurant_id) inconsistencies.push("restaurant_id diferente da sessão");
    if (o.restaurant_id !== profile.restaurantId) inconsistencies.push("restaurant_id diferente do seu usuário logado");
    if (activeOrdersOnSameTable.length > 1) inconsistencies.push("múltiplos pedidos ativos nesta mesa");
    if (!restaurantExists) inconsistencies.push("pedido órfão (restaurante não existe)");

    return {
      id: o.id,
      status: o.status,
      restaurant_id: o.restaurant_id,
      table_id: o.table_id,
      order_session_id: o.order_session_id,
      total_amount: o.total_amount,
      created_at: o.created_at,
      updated_at: o.updated_at,
      table,
      session,
      activeOrdersOnSameTable,
      restaurantExists,
      inconsistencies,
    };
  });

  return (
    <div>
      <h1>Debug Tools — Orders</h1>

      <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: 10, marginBottom: 10, background: "#fafafa" }}>
        <p>
          <strong>Ambiente:</strong> {env.ambiente}
        </p>
        <p>
          <strong>Build:</strong> {env.build}
        </p>
        <p>
          <strong>NEXT_PUBLIC_APP_URL:</strong> {env.appUrl}
        </p>
      </div>

      <p>Últimos {rows.length} pedidos, dado bruto via service role (sem RLS). Linhas vermelhas têm inconsistência.</p>

      <OrdersDebugClient rows={rows} profileRestaurantId={profile.restaurantId} />
    </div>
  );
}
