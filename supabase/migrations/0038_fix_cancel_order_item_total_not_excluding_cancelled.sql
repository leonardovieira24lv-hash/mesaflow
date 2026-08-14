-- MesaFlow/Forko — Correção: total do pedido não descontava item cancelado.
--
-- Bug real, relatado pelo dono com prints de 4 telas diferentes mostrando a
-- mesma inconsistência (Mesas, Fechar conta, Caixa ao vivo, Fechamentos):
-- cancelar 1 item de um pedido com 2+ itens tirava o item da lista
-- corretamente, mas o VALOR cobrado/registrado continuava contando o item
-- cancelado.
--
-- Causa raiz, confirmada lendo o SQL real de `cancel_order_item` (0034,
-- só republicada em 0035 pra outro motivo — este bug sobreviveu às duas):
--
--   select coalesce(sum(price * quantity), 0), count(*) filter (where cancelled_at is null)
--   into v_new_total, v_remaining_items
--   from public.order_items
--   where public.order_items.order_id = v_order_id;
--
-- O `count(*)` tinha o filtro `where cancelled_at is null` — o `sum(price *
-- quantity)` NÃO tinha. Ou seja: `orders.total_amount` era "recalculado"
-- somando TODOS os itens de novo, cancelados inclusos — na prática, um
-- no-op que nunca desconta nada.
--
-- Efeito em cascata (nenhum desses lugares está errado — todos confiam em
-- `orders.total_amount`, que é quem mentia): "Valor atual"/"Total da mesa"
-- no drawer de Mesas, Dashboard, Caixa ao vivo (resumo E detalhe de venda)
-- e a receita somada em `close_cashier` (Fechamentos, 0033) — todos
-- herdavam o valor errado. Só o modal "Fechar conta" mostrava o valor
-- certo, porque esse único lugar recalcula a partir dos itens brutos no
-- próprio app, em vez de confiar na coluna.
--
-- Correção em 2 partes:
-- 1. `cancel_order_item`: adiciona o mesmo `filter (where cancelled_at is
--    null)` que já existia no `count`, agora também no `sum`. Todo o resto
--    da function permanece idêntico a 0035.
-- 2. Backfill: pedidos que JÁ têm item cancelado agora, com
--    `total_amount` desatualizado (não vão ser tocados de novo a menos
--    que outro item seja cancelado) — recalculados uma vez aqui. Não toca
--    em `cashier_closings` (fechamentos já registrados ficam como estão,
--    são um retrato histórico — não se reescreve fechamento de caixa já
--    feito).
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

  -- Correção real desta migration: `sum(...)` ganhou o mesmo `filter
  -- (where cancelled_at is null)` que o `count(*)` ao lado já tinha —
  -- agora exclui item cancelado do total de verdade, não só da contagem.
  select
    coalesce(sum(price * quantity) filter (where cancelled_at is null), 0),
    count(*) filter (where cancelled_at is null)
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

-- Backfill único: corrige `total_amount` de pedidos que já têm item
-- cancelado agora (afetados pelo bug antes desta correção). Pedidos sem
-- nenhum item cancelado não são tocados (nada pra corrigir).
update public.orders o
set total_amount = coalesce((
  select sum(oi.price * oi.quantity)
  from public.order_items oi
  where oi.order_id = o.id
    and oi.cancelled_at is null
), 0)
where exists (
  select 1
  from public.order_items oi2
  where oi2.order_id = o.id
    and oi2.cancelled_at is not null
);
