-- MesaFlow/Forko — Correção: Ambiguidade de Coluna em cancel_order_item.
--
-- Erro real, confirmado em produção (não suposição — Postgres error code
-- 42702, capturado via diagnóstico temporário no Route Handler):
--
--   column reference "order_id" is ambiguous
--   hint: It could refer to either a PL/pgSQL variable or a table column.
--
-- Causa: `cancel_order_item` (0034) declara `returns table (order_id uuid,
-- ...)`. Em PL/pgSQL, os nomes de coluna de um `RETURNS TABLE` viram
-- automaticamente VARIÁVEIS de escopo da function inteira — exatamente como
-- parâmetros `OUT`. A function tinha uma consulta interna:
--
--   select ... from public.order_items where order_id = v_order_id;
--
-- `order_id`, sem prefixo, virou ambíguo: podia ser a variável de saída
-- (do `returns table`) ou a coluna `order_items.order_id`. O Postgres
-- recusou executar, e o erro só apareceu depois de sucessivas tentativas
-- de diagnóstico, porque a mensagem genérica do Route Handler escondia o
-- código/mensagem real do erro (já corrigido antes disso, temporariamente,
-- pra conseguir ver isto aqui).
--
-- Correção: qualifica a coluna com o nome da tabela, sem ambiguidade
-- possível. Todo o resto da function permanece idêntico ao de 0034 — só
-- esta linha muda.
create or replace function public.cancel_order_item(
  p_order_item_id uuid,
  p_restaurant_id uuid
)
returns table (
  order_id uuid,
  order_status text,
  order_total_amount numeric,
  table_released boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_table_id uuid;
  v_new_total numeric;
  v_remaining_items integer;
  v_new_order_status text;
  v_table_released boolean := false;
  v_active_orders_on_table integer;
begin
  select o.id, o.table_id
  into v_order_id, v_table_id
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.id = p_order_item_id
    and o.restaurant_id = p_restaurant_id
  for update of o;

  if v_order_id is null then
    raise exception 'Item não encontrado.' using errcode = 'P0001';
  end if;

  update public.order_items
  set cancelled_at = now()
  where id = p_order_item_id
    and cancelled_at is null;

  -- Correção real: `order_items.order_id` explícito, em vez de `order_id`
  -- sem prefixo — elimina a ambiguidade com a variável de saída do
  -- `returns table` acima.
  select coalesce(sum(price * quantity), 0), count(*) filter (where cancelled_at is null)
  into v_new_total, v_remaining_items
  from public.order_items
  where public.order_items.order_id = v_order_id;

  update public.orders
  set total_amount = v_new_total,
      status = case when v_remaining_items = 0 then 'cancelled' else status end,
      updated_at = now()
  where id = v_order_id
  returning status into v_new_order_status;

  select count(*)
  into v_active_orders_on_table
  from public.orders
  where table_id = v_table_id
    and status not in ('delivered', 'cancelled');

  if v_active_orders_on_table = 0 then
    update public.tables
    set status = 'livre'
    where id = v_table_id
      and status <> 'livre';
    v_table_released := true;
  end if;

  return query select v_order_id, v_new_order_status, v_new_total, v_table_released;
end;
$$;
