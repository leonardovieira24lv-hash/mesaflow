-- MesaFlow — Fechamento de Conta Sem Dependência de Estado de Frontend
-- (Sprint "Refatoração — Backend Assume Marcação de Entregue", 2026-07-30)
--
-- Diagnóstico anterior (mesmo dia): a correção da atomicidade
-- (`0019_atomic_close_table_bill.sql`) e a busca fresca no
-- `CloseBillModal` resolveram, cada uma, metade do problema — mas
-- `handleConfirmPayment()` (`table-drawer.tsx`) continuava decidindo quais
-- pedidos marcar como `delivered` a partir de `openOrders`, o estado de
-- interface cacheado em `tables-manager.tsx` (atualizado só por Realtime,
-- que já é uma instabilidade conhecida). Se esse estado estivesse
-- desatualizado, o laço de marcar como entregue não tocava o pedido real
-- no banco — e a função anterior, ao checar se sobrava pedido
-- não-terminal, corretamente recusava o fechamento (`P0002`). O sintoma
-- mudava de mensagem, a causa (uma escrita decidida por estado de
-- frontend) continuava.
--
-- Esta migration substitui `close_table_bill`: o próprio banco, dentro da
-- mesma transação, busca os pedidos reais da sessão e marca como
-- `delivered` qualquer um que ainda não estivesse num status terminal —
-- em vez de exigir que o chamador já tenha feito isso e só then checar.
-- O frontend passa a apenas *pedir* o fechamento; nenhuma decisão de quais
-- registros mudam depende mais de estado de interface. A checagem de
-- "ainda há pedido em aberto" (`P0002`) deixa de existir — não tem mais
-- pedido em aberto pra rejeitar, o próprio fechamento já resolve isso.
create or replace function public.close_table_bill(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_payment_method text
)
returns table (
  table_id uuid,
  table_name text,
  table_status text,
  table_qr_token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
begin
  -- `for update` trava a linha da sessão aberta desta mesa até o fim da
  -- transação — uma segunda chamada concorrente de fechamento pra mesma
  -- mesa espera aqui em vez de correr em paralelo com esta.
  select id into v_session_id
  from public.order_sessions
  where table_id = p_table_id
    and restaurant_id = p_restaurant_id
    and closed_at is null
  for update;

  if v_session_id is null then
    raise exception 'Esta mesa não tem uma comanda aberta para fechar.' using errcode = 'P0001';
  end if;

  -- Fonte da verdade é sempre o banco: qualquer pedido desta sessão que
  -- ainda não estava num status terminal vira `delivered` aqui — não
  -- depende de nada que o frontend tenha (ou não) feito antes de chamar.
  update public.orders
  set status = 'delivered', updated_at = now()
  where order_session_id = v_session_id
    and status not in ('delivered', 'cancelled');

  update public.order_sessions
  set closed_at = now(), payment_method = p_payment_method
  where id = v_session_id;

  -- Dispara `trg_enforce_no_pending_orders_on_table_release` — dentro
  -- desta mesma transação, como já era desde a 0019.
  update public.tables
  set status = 'livre'
  where id = p_table_id
    and restaurant_id = p_restaurant_id;

  return query
  select t.id, t.name, t.status, t.qr_token
  from public.tables t
  where t.id = p_table_id;
end;
$$;
