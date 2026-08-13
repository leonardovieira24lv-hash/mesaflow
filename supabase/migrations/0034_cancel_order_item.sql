-- MesaFlow/Forko — Cancelamento de Item Individual (não o pedido inteiro).
--
-- Pedido do dono: um pedido pode ter mais de um item (ex.: "2× calabresa,
-- 1× x burguer"). Cancelar o PEDIDO inteiro (já existente, endpoint
-- `orders/{id}/status`) era grande demais quando o cliente só queria tirar
-- 1 item específico e manter o resto. Precisa de granularidade de item,
-- que hoje não existe — `order_items` não tinha nenhuma noção de
-- cancelado.
--
-- Regra de negócio confirmada com o dono, palavra por palavra:
-- - Pedido com 1 item só, cancelado → o pedido inteiro cancela E a mesa
--   libera sozinha, sem precisar de um segundo clique.
-- - Pedido com 2+ itens, cancela 1 → só esse item sai do total; o pedido
--   continua ativo, mesa continua aberta, "Enviar para cozinha"/
--   "Finalizar pedido" seguem funcionando pro que sobrou.
-- - A liberação automática da mesa olha a MESA INTEIRA, não só o pedido
--   que perdeu o item — pode ter 2-3 pedidos separados na mesma mesa
--   (várias pessoas, pediram em momentos diferentes); só libera quando,
--   depois do cancelamento, não sobra NENHUM pedido ativo em NENHUM
--   pedido daquela mesa.
--
-- `order_items.cancelled_at` — mesmo padrão já usado em `order_sessions`
-- (timestamp nulo = ativo), não um enum novo — não existe "estado" de
-- item além de "ativo"/"cancelado", não precisa de máquina de estados.
alter table public.order_items
  add column if not exists cancelled_at timestamptz;

-- `security definer` — mesmo motivo de `close_table_bill`/`close_cashier`:
-- a operação precisa ler/escrever em `order_items`, `orders` e `tables`
-- na mesma transação, sem depender de RLS de escrita estar correta em
-- todas as três (a mesma suspeita de infraestrutura já documentada em
-- outras migrations). `search_path` fixo, mesmo motivo de sempre.
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
  -- Localiza o pedido/mesa dono deste item, já filtrando por restaurante —
  -- isolamento de tenant explícito, não depende de RLS. `for update of o`
  -- trava a linha do pedido — uma segunda chamada concorrente (ex.: outro
  -- item do mesmo pedido sendo cancelado ao mesmo tempo) espera essa
  -- transação terminar antes de recalcular o total, evitando ler um total
  -- desatualizado no meio do caminho.
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

  -- Idempotente: se já estava cancelado, não faz nada de novo (evita
  -- recalcular duas vezes num duplo clique/retry).
  update public.order_items
  set cancelled_at = now()
  where id = p_order_item_id
    and cancelled_at is null;

  -- Recalcula o total do pedido só com os itens ainda ativos.
  select coalesce(sum(price * quantity), 0), count(*) filter (where cancelled_at is null)
  into v_new_total, v_remaining_items
  from public.order_items
  where order_id = v_order_id;

  update public.orders
  set total_amount = v_new_total,
      -- Só vira `cancelled` se não sobrou NENHUM item ativo neste pedido —
      -- com 2+ itens e só 1 cancelado, o pedido continua no status que já
      -- estava (`pending`/`preparing`), sem interferir no fluxo normal.
      status = case when v_remaining_items = 0 then 'cancelled' else status end,
      updated_at = now()
  where id = v_order_id
  returning status into v_new_order_status;

  -- Depois de recalcular, checa se sobra ALGUM pedido ativo na MESA
  -- INTEIRA — não só neste pedido. Uma mesa pode ter vários pedidos
  -- separados (pessoas diferentes, momentos diferentes); só libera
  -- quando nenhum deles ainda está ativo. Reaproveita a trigger já
  -- existente (`trg_enforce_no_pending_orders_on_table_release`) pra
  -- fechar a `order_session` — não duplica essa lógica aqui, só muda
  -- `tables.status`, o resto já é tratado.
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
