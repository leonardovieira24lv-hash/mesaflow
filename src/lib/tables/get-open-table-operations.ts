import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";
import type { Database } from "@/types/database.types";
import type { OrderStatus } from "@/types/domain";

/**
 * Sprint "Fonte Única de Verdade — order_session" (2026-07-30, seguinte à
 * Correção "Pedido Finalizado Sumindo da Mesa"):
 *
 * A investigação anterior corrigiu o sintoma (mesa "livre" mostrando
 * valor/pedidos de uma comanda já fechada) trocando a lista de status da
 * query de `GET /api/v1/tables/{id}/close-bill` para incluir `delivered` —
 * mas isso trocou um filtro de status errado por outro que também podia
 * ficar errado no futuro. A causa de verdade nunca foi "qual lista de
 * status", foi: **nenhum pedido deveria alimentar o card de uma mesa se
 * não pertencer à comanda (`order_session`) atualmente aberta dela** —
 * status nunca deveria decidir isso.
 *
 * Este módulo é a única implementação dessa regra no projeto. Antes desta
 * extração, ela existia só dentro do `GET` de
 * `api/v1/tables/{id}/close-bill/route.ts` (uma mesa por vez); o Painel de
 * Mesas precisava do mesmo critério para o restaurante inteiro de uma vez,
 * e a chance real de as duas cópias divergirem com o tempo foi o motivo
 * desta extração — daqui pra frente, mudar a regra de "o que é uma comanda
 * ativa" significa mudar aqui, uma vez, e as duas rotas herdam a mudança
 * juntas.
 */

type Client = SupabaseClient<Database>;

export interface OpenOrderSession {
  id: string;
  tableId: string;
  openedAt: string;
}

/**
 * Sessões abertas (`closed_at is null`) do restaurante — no máximo uma por
 * mesa, garantido por `create-order.ts` (sempre reaproveita a sessão aberta
 * existente da mesa antes de criar outra). Passar `tableId` escopa a busca
 * a uma única mesa (uso do `close-bill`); omitir devolve todas as sessões
 * abertas do restaurante de uma vez (uso do Painel de Mesas) — mesma query,
 * só um `.eq` a mais quando faz sentido, para nunca haver duas
 * implementações desta busca.
 */
export async function getOpenOrderSessions(
  supabase: Client,
  restaurantId: string,
  tableId?: string,
): Promise<OpenOrderSession[]> {
  let query = supabase
    .from("order_sessions")
    .select("id, table_id, opened_at")
    .eq("restaurant_id", restaurantId)
    .is("closed_at", null);

  if (tableId) {
    query = query.eq("table_id", tableId);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível carregar a comanda desta mesa.");
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    tableId: row.table_id as string,
    openedAt: row.opened_at as string,
  }));
}

export interface OpenSessionOrder {
  id: string;
  orderSessionId: string;
  table: { id: string; name: string };
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  items: { name: string; quantity: number; price: number }[];
}

/**
 * Pedidos das sessões informadas — filtrados **só** por `order_session_id`,
 * nunca por `status`. É este `where` que elimina, de vez, a dependência de
 * lista de status para decidir "isto é uma comanda aberta": um pedido
 * `delivered`, `preparing`, ou o que for, continua contando enquanto a
 * sessão que o contém não tiver `closed_at` — e para de contar no instante
 * em que ela fecha (`close_table_bill`/trigger de liberar mesa), não
 * importa em que status o pedido ficou.
 *
 * Seleciona `order_items(name, quantity, price)` — o detalhe completo que
 * o modal de fechamento precisa — em vez de só a contagem. O Painel de
 * Mesas (que só precisa da quantidade) deriva `items.length` do mesmo
 * resultado; a alternativa (duas queries com seleções diferentes) evitaria
 * um pouco de dado a mais trafegado por comanda aberta, mas duplicaria
 * exatamente a query que este módulo existe para não duplicar. Volume por
 * comanda é pequeno (poucos pedidos, poucos itens cada) — não compensa.
 */
export async function getOrdersForSessions(
  supabase: Client,
  sessionIds: string[],
): Promise<OpenSessionOrder[]> {
  if (sessionIds.length === 0) return [];

  const { data, error } = await supabase
    .from("orders")
    .select("id, order_session_id, status, total_amount, created_at, table:tables(id, name), order_items(name, quantity, price)")
    .in("order_session_id", sessionIds);

  if (error) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível carregar os pedidos desta comanda.");
  }

  // Mesmo motivo do cast em `lib/dashboard/queries.ts`/`api/v1/orders/route.ts`:
  // sem os tipos gerados do Supabase (`Database` ainda é `any` neste
  // ambiente), o parsing estrutural do `select()` infere `table` como
  // array (relação many-to-one embutida pelo PostgREST como objeto único
  // em tempo de execução).
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    order_session_id: string;
    status: OrderStatus;
    total_amount: number;
    created_at: string;
    table: { id: string; name: string } | null;
    order_items: { name: string; quantity: number; price: number }[] | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    orderSessionId: row.order_session_id,
    table: { id: row.table?.id ?? "", name: row.table?.name ?? "—" },
    status: row.status,
    totalAmount: row.total_amount,
    createdAt: row.created_at,
    items: row.order_items ?? [],
  }));
}
