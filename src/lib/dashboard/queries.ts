import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderStatus } from "@/types/domain";
import type { Database } from "@/types/database.types";
import { getOpenOrderSessions, getOrdersForSessions } from "@/lib/tables/get-open-table-operations";
import { getCashierData, resolveCashierDateRange } from "@/lib/cashier/queries";

export interface RecentOrder {
  id: string;
  tableName: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
}

/**
 * Últimos pedidos do restaurante, para o widget "Últimos pedidos" do
 * Dashboard. Somente leitura, sob demanda (sem Supabase Realtime) — o
 * Dashboard só atualiza este widget ao recarregar a página; a tela com
 * atualização em tempo real de verdade é o Painel de Pedidos (contrato
 * seção 8.1), que já existe desde a Sprint 8.
 *
 * Nota corrigida na Sprint Final (RC1): o comentário original desta função
 * (da Sprint 5, quando o Dashboard foi construído antes do módulo de
 * Pedidos existir) dizia que esta consulta "sempre volta vazia" — isso
 * deixou de ser verdade desde a Sprint 8, quando pedidos passaram a ser
 * criados de verdade. A consulta é real e já reflete dado real; o
 * comentário antigo só nunca tinha sido atualizado.
 */
export async function getRecentOrders(
  supabase: SupabaseClient<Database>,
  restaurantId: string,
  limit = 5,
): Promise<RecentOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, total_amount, created_at, tables(name)")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  // `orders.table_id` referencia uma única `tables` (many-to-one) — em tempo
  // de execução o PostgREST embute um objeto único, não uma lista. Mas o
  // parsing estrutural da string de `select()` do postgrest-js infere
  // `tables` como array por padrão (não depende de `Database` estar
  // tipado de verdade), então o compilador via `order.tables` como
  // `{ name: any }[]`, sem `.name` — daí o cast explícito abaixo em vez de
  // acessar o campo direto no tipo inferido.
  const rows = data as unknown as Array<{
    id: string;
    status: OrderStatus;
    total_amount: number;
    created_at: string;
    tables: { name: string } | null;
  }>;

  return rows.map((order) => ({
    id: order.id,
    tableName: order.tables?.name ?? "—",
    status: order.status,
    totalAmount: order.total_amount,
    createdAt: order.created_at,
  }));
}

/**
 * Contagem de mesas ocupadas — Sprint UI-05 ("Ações Necessárias"/"Mesas
 * ocupadas"). Mesmo critério (`tables.status = 'ocupada'`) já usado em
 * `tables-manager.tsx` (`occupiedCount`) — aqui só um `COUNT` no servidor,
 * nenhuma regra nova.
 */
export async function getOccupiedTablesCount(
  supabase: SupabaseClient<Database>,
  restaurantId: string,
): Promise<{ occupied: number; total: number }> {
  const [occupiedResult, totalResult] = await Promise.all([
    supabase
      .from("tables")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("status", "ocupada"),
    supabase.from("tables").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId),
  ]);

  return { occupied: occupiedResult.count ?? 0, total: totalResult.count ?? 0 };
}

/**
 * Contagem de pedidos `pending` do restaurante inteiro — mesmo critério que
 * já governa `hasUnprocessedOrders`/`hasPendingOrder`
 * (`lib/mesas/derive-table-card-state.ts`), agregado aqui por restaurante
 * em vez de por mesa. Nenhuma sessão fechada deveria ter pedido `pending`
 * residual (a própria trigger de liberação de mesa e o fechamento de conta
 * já impedem isso), então não precisa de filtro extra por sessão aberta.
 */
export async function getPendingOrdersCount(supabase: SupabaseClient<Database>, restaurantId: string): Promise<number> {
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("status", "pending");

  return count ?? 0;
}

/**
 * Contagem de pedidos `preparing` do restaurante inteiro — Sprint
 * "Dashboard Executivo" (2026-08-07). Mesmo formato de
 * `getPendingOrdersCount` (acima), só trocando o status filtrado; usado
 * pelo item "Pedidos em Preparo" de `<TodaySummary>`.
 */
export async function getPreparingOrdersCount(
  supabase: SupabaseClient<Database>,
  restaurantId: string,
): Promise<number> {
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("status", "preparing");

  return count ?? 0;
}

/**
 * Contagem de eventos de mesa em aberto (`table_events.status = 'open'`),
 * por tipo — mesmo filtro de `GET /api/v1/tables/events?status=open`
 * (`api/v1/tables/events/route.ts`), a mesma consulta que já alimenta os
 * alertas do Painel de Mesas. Não reaproveita a Route Handler em si (Server
 * Component chamando a própria API é o mesmo anti-padrão já evitado em
 * `getRestaurantOverview`) — só o critério de filtro é o mesmo.
 */
export async function getPendingTableEventCounts(
  supabase: SupabaseClient<Database>,
  restaurantId: string,
): Promise<{ waiterCall: number; billRequest: number }> {
  const { data, error } = await supabase
    .from("table_events")
    .select("type")
    .eq("restaurant_id", restaurantId)
    .eq("status", "open");

  if (error || !data) return { waiterCall: 0, billRequest: 0 };

  const rows = data as unknown as Array<{ type: "waiter_call" | "bill_request" }>;
  return {
    waiterCall: rows.filter((r) => r.type === "waiter_call").length,
    billRequest: rows.filter((r) => r.type === "bill_request").length,
  };
}

/**
 * Soma dos pedidos em sessões de mesa ainda abertas ("Valor em aberto") —
 * mesmo cálculo que `openAmount` em `tables-manager.tsx`, reaproveitando
 * diretamente `getOpenOrderSessions`/`getOrdersForSessions`
 * (`lib/tables/get-open-table-operations.ts`, sem `tableId` = restaurante
 * inteiro), a mesma função já usada por `close-bill` e
 * `tables/operations`.
 */
export async function getOpenAmount(supabase: SupabaseClient<Database>, restaurantId: string): Promise<number> {
  const sessions = await getOpenOrderSessions(supabase, restaurantId);
  if (sessions.length === 0) return 0;

  const orders = await getOrdersForSessions(
    supabase,
    sessions.map((s) => s.id),
  );
  return orders.reduce((sum, order) => sum + order.totalAmount, 0);
}

/**
 * Faturamento + ticket médio de hoje — reaproveita `getCashierData`
 * (`lib/cashier/queries.ts`), a mesma consulta que já alimenta a tela de
 * Caixa, só com o intervalo "hoje" (`resolveCashierDateRange("today")`).
 * `perPage: 1` porque só o `summary` importa aqui — a lista de sessões
 * devolvida é descartada.
 */
export async function getTodaySalesSummary(
  supabase: SupabaseClient<Database>,
  restaurantId: string,
): Promise<{ revenue: number; averageTicket: number }> {
  const { from, to } = resolveCashierDateRange("today");
  const result = await getCashierData(supabase, restaurantId, { from, to, page: 1, perPage: 1 });
  return { revenue: result.summary.revenue, averageTicket: result.summary.averageTicket };
}

export async function getOrdersTodayCount(
  supabase: SupabaseClient<Database>,
  restaurantId: string,
): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .gte("created_at", startOfDay.toISOString());

  return count ?? 0;
}
