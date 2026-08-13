-- MesaFlow/Forko — Sprint 13.9.2: Prevenir Fechamento Duplicado de Caixa.
--
-- Achado da Sprint 13.9 (auditoria): `close_cashier` (0024) não tinha
-- nenhuma proteção contra ser chamada duas vezes para o mesmo período —
-- duplo clique, retry de rede ou dois atendentes fechando ao mesmo tempo
-- geravam dois registros separados em `cashier_closings` para a mesma
-- combinação lógica de restaurante/período/dia.
--
-- Sprint 13.9.1 mostrou que `UNIQUE (restaurant_id, period_from, period_to)`
-- não resolveria de verdade: `resolveCashierDateRange()` sempre usa "agora"
-- como `period_to` para `today`/`7d`/`30d` — duas chamadas segundos depois
-- uma da outra têm `period_to` diferente, então uma UNIQUE nas colunas
-- cruas nunca pegaria o caso mais comum (duplo clique).
--
-- Sprint 13.9.2 validou a estratégia abaixo e aprovou explicitamente:
--
-- 1) `pg_advisory_xact_lock` no início da function, chaveado por
--    `restaurant_id + period_type + date_trunc('day', period_from)` — não
--    pelas colunas cruas de timestamp. `date_trunc('day', ...)` resolve o
--    problema acima: para `7d`/`30d`, só a HORA de `period_from` varia
--    entre chamadas no mesmo dia (o componente de dia só muda quando
--    "agora" cruza a meia-noite) — o truncamento descarta exatamente a
--    parte que antes causava a não-detecção.
-- 2) Lock de escopo de transação (`_xact_lock`, não precisa de `unlock`
--    manual) — libera sozinho no commit ou no rollback.
-- 3) Depois do lock, uma segunda chamada concorrente para a MESMA chave
--    espera até a primeira transação terminar; ao continuar, o `select
--    exists` já enxerga o commit da primeira (READ COMMITTED, padrão do
--    Postgres) e rejeita com `P0001` — convertido em `409 CONFLICT` pelo
--    Route Handler (mesmo padrão de `close_table_bill`/`close-bill/route.ts`).
-- 4) `hashtextextended` (64 bits) — colisão de hash não corrompe nada:
--    a decisão de bloquear usa as colunas reais no `select exists`, o hash
--    só decide a ORDEM de execução entre chamadas.
--
-- Todo o restante do corpo da function é idêntico ao de
-- `0024_create_close_cashier_function.sql` — só a checagem no início foi
-- adicionada. Migrations antigas nunca são editadas; esta substitui a
-- implementação via `create or replace function`, mesmo padrão já usado
-- quando `close_table_bill` foi corrigida (`0019`→`0020`).
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
  -- Sprint 13.9.2 — serializa chamadas concorrentes para a mesma chave
  -- lógica de fechamento (restaurante + tipo de período + dia de
  -- referência), antes de qualquer leitura/escrita abaixo.
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_restaurant_id::text || ':' || p_period_type || ':' ||
      date_trunc('day', p_period_from)::text,
      0
    )
  );

  -- Sprint 13.9.2 — depois do lock, rejeita se este período já foi
  -- fechado (checagem pelas colunas reais, não pelo hash usado só para
  -- ordenar a espera acima).
  if exists (
    select 1
    from public.cashier_closings
    where restaurant_id = p_restaurant_id
      and period_type = p_period_type
      and date_trunc('day', period_from) = date_trunc('day', p_period_from)
  ) then
    raise exception 'Este período já foi fechado.' using errcode = 'P0001';
  end if;

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
