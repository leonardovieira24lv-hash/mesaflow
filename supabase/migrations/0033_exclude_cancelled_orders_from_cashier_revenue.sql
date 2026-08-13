-- MesaFlow/Forko — Correção: Pedido Cancelado Contando como Receita.
--
-- Achado relatado pelo dono: liberar uma mesa depois de o cliente cancelar
-- o pedido fazia esse valor aparecer no Caixa como se tivesse sido
-- recebido de verdade.
--
-- Causa raiz, confirmada lendo o SQL real (não suposição):
-- `trg_enforce_no_pending_orders_on_table_release` (0011) já fecha
-- sozinha qualquer `order_session` ainda aberta quando a mesa é liberada
-- (comportamento correto, evita sessão presa) — mas `close_cashier`
-- (0024, ajustada em 0032) somava `orders.total_amount` de TODOS os
-- pedidos de uma sessão fechada, sem excluir os `cancelled`. Não é
-- exclusivo do caminho "liberar mesa": o mesmo problema existiria se um
-- cliente cancelasse 1 pedido de 2 numa sessão fechada normalmente via
-- "Fechar conta" — o pedido cancelado ainda entraria na soma.
--
-- Dono confirmou explicitamente: uma sessão onde TODOS os pedidos foram
-- cancelados (mesa ocupada, cliente foi embora sem consumir nada) não deve
-- contar em NENHUMA métrica do Caixa — nem receita, nem "sessões
-- fechadas", nem "mesas atendidas" — é só ruído no relatório, não uma
-- venda que não aconteceu.
--
-- Estratégia: uma sessão só é "relevante" pro fechamento de caixa se tiver
-- pelo menos 1 pedido que não seja `cancelled`. Sessões irrelevantes saem
-- das 3 métricas ao mesmo tempo (`revenue`, `closed_sessions_count`,
-- `tables_served_count`) — não só da receita. Dentro de uma sessão
-- relevante, pedidos cancelados continuam de fora só da soma de receita
-- (cobre o caso de cancelamento parcial, sessão com mais de 1 pedido).
--
-- Todo o resto da function (advisory lock + checagem de fechamento
-- duplicado, adicionados em 0032) permanece idêntico — só o bloco de
-- cálculo muda.
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

  -- Sessão "relevante": fechada dentro do período E com pelo menos 1
  -- pedido que não seja `cancelled`. Sessão sem nenhum pedido válido não
  -- entra em nenhuma das 3 métricas abaixo.
  with relevant_sessions as (
    select os.id, os.table_id
    from public.order_sessions os
    where os.restaurant_id = p_restaurant_id
      and os.closed_at is not null
      and os.closed_at >= p_period_from
      and os.closed_at <= p_period_to
      and exists (
        select 1
        from public.orders o
        where o.order_session_id = os.id
          and o.status <> 'cancelled'
      )
  )
  select
    coalesce((
      select sum(o.total_amount)
      from public.orders o
      where o.order_session_id in (select id from relevant_sessions)
        and o.status <> 'cancelled'
    ), 0),
    (select count(*) from relevant_sessions),
    (select count(distinct table_id) from relevant_sessions)
  into v_revenue, v_closed_sessions_count, v_tables_served_count;

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
