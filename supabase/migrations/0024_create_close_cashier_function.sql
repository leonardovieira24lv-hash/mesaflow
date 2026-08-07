-- MesaFlow — RPC close_cashier: recalcula e grava o snapshot do
-- fechamento de caixa numa única transação (Sprint 2 "Persistência do
-- Fechamento de Caixa", 2026-08-06).
--
-- Mesmo padrão de `close_table_bill` (`0019_atomic_close_table_bill.sql`
-- em diante): toda a regra de negócio vive aqui dentro, não no Route
-- Handler — `POST /api/v1/cashier/close` só autentica, valida o formato
-- do body e chama esta function. `security definer` para poder
-- ler/gravar independentemente de RLS, do mesmo jeito que
-- `close_table_bill` já faz.
--
-- Os agregados replicam exatamente o critério de `getCashierData`
-- (`lib/cashier/queries.ts`): sessões de `order_sessions` do restaurante,
-- com `closed_at` preenchido e dentro de `[p_period_from, p_period_to]`,
-- somando `orders.total_amount` de cada sessão. Diferença intencional: a
-- busca por texto (`search`) da tela de listagem NÃO entra aqui — o
-- fechamento sempre reflete o período inteiro, nunca um subconjunto
-- filtrado por uma busca que é só conveniência de navegação na tabela.
--
-- `p_restaurant_id`/`p_closed_by` sempre vêm de `requireSession()` no
-- Route Handler, nunca do body enviado pelo client — mesma garantia já
-- usada em `close_table_bill`.
create or replace function public.close_cashier(
  p_restaurant_id uuid,
  p_closed_by uuid,
  p_period_type text,
  p_period_from timestamptz,
  p_period_to timestamptz,
  p_observations text default null
)
returns table (
  closing_id uuid,
  revenue numeric,
  closed_sessions_count integer,
  average_ticket numeric,
  tables_served_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closing_id uuid;
  v_revenue numeric;
  v_closed_sessions_count integer;
  v_tables_served_count integer;
  v_average_ticket numeric;
begin
  -- `left join`: uma sessão fechada sem nenhum pedido ainda conta como
  -- comanda fechada (mesmo comportamento de `getCashierData`, que itera
  -- todas as sessões do período e soma 0 quando `orders` vem vazio) —
  -- `inner join` a excluiria da contagem por engano.
  select
    coalesce(sum(o.total_amount), 0),
    count(distinct os.id),
    count(distinct os.table_id)
  into v_revenue, v_closed_sessions_count, v_tables_served_count
  from public.order_sessions os
  left join public.orders o on o.order_session_id = os.id
  where os.restaurant_id = p_restaurant_id
    and os.closed_at is not null
    and os.closed_at >= p_period_from
    and os.closed_at <= p_period_to;

  v_average_ticket := case
    when v_closed_sessions_count > 0 then v_revenue / v_closed_sessions_count
    else 0
  end;

  insert into public.cashier_closings (
    restaurant_id, closed_by, period_type, period_from, period_to,
    revenue, closed_sessions_count, average_ticket, tables_served_count, observations
  )
  values (
    p_restaurant_id, p_closed_by, p_period_type, p_period_from, p_period_to,
    v_revenue, v_closed_sessions_count, v_average_ticket, v_tables_served_count, p_observations
  )
  returning id into v_closing_id;

  return query
  select v_closing_id, v_revenue, v_closed_sessions_count, v_average_ticket, v_tables_served_count;
end;
$$;
