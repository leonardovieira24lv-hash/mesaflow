import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderStatus } from "@/types/domain";
import type { Database } from "@/types/database.types";

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

/** Contagem de pedidos criados desde o início do dia local — indicador rápido do Dashboard. */
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
