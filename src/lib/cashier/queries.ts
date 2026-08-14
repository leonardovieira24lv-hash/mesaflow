import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";
import { PAYMENT_METHOD_VALUES } from "@/lib/validations/tables";
import type { CashierPeriod } from "@/lib/validations/cashier";
import type { Database } from "@/types/database.types";

export type PaymentMethod = (typeof PAYMENT_METHOD_VALUES)[number];

/**
 * Rótulos de exibição da forma de pagamento — específicos da tela de
 * Caixa. Não reaproveita nada de `close-bill-modal.tsx` de propósito: essa
 * tela é uma funcionalidade já estável (Sprint "Fechamento de Conta com
 * Registro de Venda") e esta sprint não deve alterá-la; duplicar um mapa
 * de 4 linhas é um custo bem menor do que mexer em código estável só para
 * compartilhar uma constante pequena.
 */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "PIX",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  cash: "Dinheiro",
};

export interface ClosedSessionRow {
  id: string;
  tableId: string;
  tableName: string;
  openedAt: string;
  closedAt: string;
  paymentMethod: PaymentMethod | null;
  totalAmount: number;
  itemCount: number;
}

export interface CashierSummary {
  revenue: number;
  closedSessionsCount: number;
  averageTicket: number;
  tablesServedCount: number;
}

export interface CashierListResult {
  summary: CashierSummary;
  sessions: ClosedSessionRow[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

export interface CashierSessionDetail {
  id: string;
  tableName: string;
  openedAt: string;
  closedAt: string;
  paymentMethod: PaymentMethod | null;
  totalAmount: number;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    // Sistema de Opcionais, Fase 1, Passo 4 (2026-08-14).
    selectedOptions?: { group_name: string; option_name: string; price_delta: number }[];
  }[];
}

/**
 * Converte `period` (+ `start`/`end` quando "custom") num intervalo
 * `[from, to]` em ISO — mesma limitação já aceita no resto do projeto
 * (nenhum tratamento de fuso horário específico do restaurante existe
 * ainda; usa o relógio do servidor, igual a `formatRelativeTimeShort` e
 * companhia). "Hoje"/"Ontem" usam meia-noite UTC como início do dia.
 */
export function resolveCashierDateRange(
  period: CashierPeriod,
  startDate?: string,
  endDate?: string,
): { from: string; to: string } {
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  switch (period) {
    case "today":
      return { from: startOfToday.toISOString(), to: now.toISOString() };
    case "yesterday": {
      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setUTCDate(startOfYesterday.getUTCDate() - 1);
      return { from: startOfYesterday.toISOString(), to: startOfToday.toISOString() };
    }
    case "7d": {
      const from = new Date(now);
      from.setUTCDate(from.getUTCDate() - 7);
      return { from: from.toISOString(), to: now.toISOString() };
    }
    case "30d": {
      const from = new Date(now);
      from.setUTCDate(from.getUTCDate() - 30);
      return { from: from.toISOString(), to: now.toISOString() };
    }
    case "custom": {
      // `.refine()` do schema já garante que os dois vêm preenchidos antes
      // daqui — `end_date` é tratado como o FIM daquele dia (23:59:59),
      // não a meia-noite dele, senão o próprio dia final ficaria de fora.
      const from = new Date(startDate!);
      const to = new Date(endDate!);
      to.setUTCHours(23, 59, 59, 999);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    default: {
      // Checagem de exaustividade em tempo de compilação: se
      // `CASHIER_PERIOD_VALUES` ganhar um valor novo sem um `case`
      // correspondente aqui, esta linha para de compilar (em vez de cair
      // num `default` silencioso em runtime) — também é o que deixa o
      // `switch` provadamente exaustivo para o TypeScript, sem precisar de
      // `as Point`/`!` no retorno da função.
      const exhaustiveCheck: never = period;
      throw new Error(`Período de caixa não tratado: ${exhaustiveCheck}`);
    }
  }
}

interface SessionQueryRow {
  id: string;
  table_id: string;
  opened_at: string;
  closed_at: string;
  payment_method: PaymentMethod | null;
  tables: { name: string } | null;
  orders: { status: string; total_amount: number; order_items: { quantity: number }[] }[];
}

/**
 * Busca as comandas fechadas do restaurante num intervalo, já com o
 * resumo (faturamento/contagem/ticket médio/mesas atendidas) calculado
 * sobre o MESMO conjunto filtrado — nunca duas consultas que poderiam
 * divergir uma da outra.
 *
 * A filtragem por `search` (mesa ou "número da comanda" — este último não
 * é uma coluna real, é um recorte do próprio `id` exibido na tela,
 * `id.slice(0,8)`) acontece em memória, depois da consulta ao banco —
 * deliberado: não existe uma coluna real de "número da comanda" pra
 * filtrar no SQL, e o volume de comandas fechadas num período (mesmo 30
 * dias, num restaurante pequeno/médio) é pequeno o suficiente pra isso não
 * pesar. O filtro por período, esse sim, é feito no banco (`closed_at`,
 * com o índice da migration 0018) — é o filtro que realmente precisa de
 * um índice, porque pode cobrir muito mais linhas.
 *
 * Preparado para uso futuro por relatórios/exportação PDF/Excel/dashboard
 * financeiro: quem precisar do mesmo recorte de dados chama esta função
 * direto, em vez de duplicar a consulta.
 */
export async function getCashierData(
  supabase: SupabaseClient<Database>,
  restaurantId: string,
  options: { from: string; to: string; search?: string; page: number; perPage: number },
): Promise<CashierListResult> {
  const { data, error } = await supabase
    .from("order_sessions")
    .select(
      "id, table_id, opened_at, closed_at, payment_method, tables(name), orders(status, total_amount, order_items(quantity))",
    )
    .eq("restaurant_id", restaurantId)
    .not("closed_at", "is", null)
    .gte("closed_at", options.from)
    .lte("closed_at", options.to)
    .order("closed_at", { ascending: false });

  if (error) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível carregar as vendas do caixa.");
  }

  // Ver nota em `RecentOrder`/`getRecentOrders` (`lib/dashboard/queries.ts`):
  // o parsing estrutural do postgrest-js infere relações embutidas como
  // array mesmo quando a query real devolve um objeto único
  // (`tables`, many-to-one) — o cast aqui só corrige o tipo pro que a
  // consulta realmente devolve, não muda nenhum dado.
  const rows = (data ?? []) as unknown as SessionQueryRow[];

  // Correção: pedido cancelado nunca deve contar como venda — nem no
  // valor, nem nos itens, nem na sessão inteira aparecer como "comanda
  // fechada" se TODOS os pedidos dela foram cancelados (mesa que só teve
  // cancelamento não é uma venda que não aconteceu, é ruído no relatório).
  // Mesmo critério usado em `close_cashier` (RPC, ajustada na mesma
  // correção) — as duas fontes agora concordam.
  const allSessions: ClosedSessionRow[] = rows
    .map((row) => {
      const validOrders = row.orders.filter((order) => order.status !== "cancelled");
      const totalAmount = validOrders.reduce((sum, order) => sum + order.total_amount, 0);
      const itemCount = validOrders.reduce(
        (sum, order) => sum + order.order_items.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0,
      );

      return {
        id: row.id,
        tableId: row.table_id,
        tableName: row.tables?.name ?? "—",
        openedAt: row.opened_at,
        closedAt: row.closed_at,
        paymentMethod: row.payment_method,
        totalAmount,
        itemCount,
        hasValidOrders: validOrders.length > 0,
      };
    })
    .filter((session) => session.hasValidOrders)
    .map(({ hasValidOrders: _hasValidOrders, ...session }) => session);

  const normalizedSearch = options.search?.trim().toLocaleLowerCase("pt-BR");
  const filtered = normalizedSearch
    ? allSessions.filter(
        (session) =>
          session.tableName.toLocaleLowerCase("pt-BR").includes(normalizedSearch) ||
          session.id.slice(0, 8).toLocaleLowerCase("pt-BR").includes(normalizedSearch),
      )
    : allSessions;

  const revenue = filtered.reduce((sum, session) => sum + session.totalAmount, 0);
  const closedSessionsCount = filtered.length;
  const tablesServedCount = new Set(filtered.map((session) => session.tableId)).size;
  const averageTicket = closedSessionsCount > 0 ? revenue / closedSessionsCount : 0;

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / options.perPage));
  const start = (options.page - 1) * options.perPage;
  const pageSessions = filtered.slice(start, start + options.perPage);

  return {
    summary: { revenue, closedSessionsCount, averageTicket, tablesServedCount },
    sessions: pageSessions,
    meta: { page: options.page, perPage: options.perPage, total, totalPages },
  };
}

interface SessionDetailQueryRow {
  id: string;
  opened_at: string;
  closed_at: string;
  payment_method: PaymentMethod | null;
  tables: { name: string } | null;
  orders: {
    status: string;
    total_amount: number;
    order_items: {
      name: string;
      quantity: number;
      price: number;
      selected_options: { group_name: string; option_name: string; price_delta: number }[] | null;
    }[];
  }[];
}

/** Detalhe de uma comanda fechada, para o modal "ao tocar em uma venda". */
export async function getCashierSessionDetail(
  supabase: SupabaseClient<Database>,
  restaurantId: string,
  sessionId: string,
): Promise<CashierSessionDetail | null> {
  const { data, error } = await supabase
    .from("order_sessions")
    .select(
      "id, opened_at, closed_at, payment_method, tables(name), orders(status, total_amount, order_items(name, quantity, price, selected_options))",
    )
    .eq("id", sessionId)
    .eq("restaurant_id", restaurantId)
    .not("closed_at", "is", null)
    .maybeSingle();

  if (error) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível carregar os detalhes desta venda.");
  }
  if (!data) return null;

  const row = data as unknown as SessionDetailQueryRow;

  // Mesmo critério de getCashierData acima — pedido cancelado não aparece
  // como item vendido nem entra no total desta comanda.
  const validOrders = row.orders.filter((order) => order.status !== "cancelled");

  // Consolida itens iguais (mesmo nome+preço+opções escolhidas) vindos de
  // pedidos diferentes da mesma comanda numa linha só — mesmo critério já
  // usado em `close-bill-modal.tsx` pro resumo de fechamento.
  //
  // Sistema de Opcionais, Fase 1, Passo 4 (2026-08-14): nome+preço sozinhos
  // não bastam mais pra identificar "o mesmo item" — o preço já inclui o
  // price_delta da opção escolhida, então duas opções diferentes com o
  // mesmo delta (ex.: "Catupiry +R$5" e "Cheddar +R$5") cairiam na mesma
  // chave e se misturariam numa venda fechada. A assinatura das opções
  // entra na chave, mesmo princípio de `optionsSignature` no carrinho.
  function optionsKeyPart(
    options: { group_name: string; option_name: string; price_delta: number }[] | null,
  ): string {
    return (options ?? [])
      .map((o) => `${o.group_name}:${o.option_name}`)
      .sort()
      .join(",");
  }

  const linesByKey = new Map<
    string,
    {
      name: string;
      quantity: number;
      unitPrice: number;
      selectedOptions?: { group_name: string; option_name: string; price_delta: number }[];
    }
  >();
  for (const order of validOrders) {
    for (const item of order.order_items) {
      const key = `${item.name}__${item.price}__${optionsKeyPart(item.selected_options)}`;
      const existing = linesByKey.get(key);
      if (existing) existing.quantity += item.quantity;
      else
        linesByKey.set(key, {
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          selectedOptions: item.selected_options ?? undefined,
        });
    }
  }

  const items = Array.from(linesByKey.values()).map((line) => ({
    ...line,
    lineTotal: line.unitPrice * line.quantity,
  }));

  return {
    id: row.id,
    tableName: row.tables?.name ?? "—",
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    paymentMethod: row.payment_method,
    totalAmount: validOrders.reduce((sum, order) => sum + order.total_amount, 0),
    items,
  };
}

export interface CashierClosingRow {
  id: string;
  closedAt: string;
  periodType: CashierPeriod;
  periodFrom: string;
  periodTo: string;
  revenue: number;
  closedSessionsCount: number;
  averageTicket: number;
  tablesServedCount: number;
  observations: string | null;
}

export interface CashierClosingsResult {
  closings: CashierClosingRow[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

/**
 * Histórico de fechamentos de caixa (feature "Histórico de Fechamentos",
 * 2026-08-14) — lê `cashier_closings` (existe desde a Sprint 2 de
 * Persistência do Fechamento, mas nunca tinha sido lida de volta por
 * nenhuma tela: só era gravada). Índice já existe pra exatamente esta
 * consulta (`cashier_closings_restaurant_closed_at_idx`,
 * `0023_create_cashier_closings.sql`) — "fechamentos deste restaurante,
 * mais recentes primeiro", sem precisar de migration nova.
 *
 * Só leitura, sem filtro de busca nesta primeira versão (paridade com o
 * pedido original: "consultar o histórico", não uma tabela cheia de
 * filtros). `closed_by` (quem fechou) não é resolvido aqui de propósito —
 * exigiria `admin.auth.admin.getUserById` por fechamento (mesmo padrão de
 * `getTeamMembers`), custo N+1 desnecessário pra esta etapa; fica como
 * possível adição futura, não bloqueia o essencial pedido agora.
 */
export async function getCashierClosings(
  supabase: SupabaseClient<Database>,
  restaurantId: string,
  { page, perPage }: { page: number; perPage: number },
): Promise<CashierClosingsResult> {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data, error, count } = await supabase
    .from("cashier_closings")
    .select(
      "id, closed_at, period_type, period_from, period_to, revenue, closed_sessions_count, average_ticket, tables_served_count, observations",
      { count: "exact" },
    )
    .eq("restaurant_id", restaurantId)
    .order("closed_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível carregar o histórico de fechamentos.");
  }

  const total = count ?? 0;

  return {
    closings: (data ?? []).map((row) => ({
      id: row.id,
      closedAt: row.closed_at,
      periodType: row.period_type as CashierPeriod,
      periodFrom: row.period_from,
      periodTo: row.period_to,
      revenue: row.revenue,
      closedSessionsCount: row.closed_sessions_count,
      averageTicket: row.average_ticket,
      tablesServedCount: row.tables_served_count,
      observations: row.observations,
    })),
    meta: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
  };
}

