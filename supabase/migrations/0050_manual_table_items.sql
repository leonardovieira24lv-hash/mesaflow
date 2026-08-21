-- FORKO — lançamento manual de item/valor na comanda da mesa.
-- Usa `orders`/`order_items` existentes para que histórico, impressão,
-- fechamento de conta e caixa continuem no mesmo fluxo.

alter table public.order_items
  alter column menu_item_id drop not null;

create or replace function public.add_manual_table_item(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_name text,
  p_amount numeric,
  p_notes text default null
)
returns table (
  order_id uuid,
  order_session_id uuid,
  total_amount numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_order_id uuid;
  v_table_status text;
  v_amount numeric(10,2);
begin
  v_amount := round(p_amount, 2);

  if nullif(trim(p_name), '') is null then
    raise exception 'INVALID_MANUAL_ITEM_NAME' using errcode = 'P0001';
  end if;

  if v_amount <= 0 then
    raise exception 'INVALID_MANUAL_ITEM_AMOUNT' using errcode = 'P0001';
  end if;

  select t.status
    into v_table_status
  from public.tables t
  where t.id = p_table_id
    and t.restaurant_id = p_restaurant_id
  for update;

  if v_table_status is null then
    raise exception 'TABLE_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_table_status = 'manutencao' then
    raise exception 'TABLE_MAINTENANCE' using errcode = 'P0001';
  end if;

  select s.id
    into v_session_id
  from public.order_sessions s
  where s.restaurant_id = p_restaurant_id
    and s.table_id = p_table_id
    and s.closed_at is null
  order by s.opened_at desc
  limit 1
  for update;

  if v_session_id is null then
    insert into public.order_sessions (restaurant_id, table_id)
    values (p_restaurant_id, p_table_id)
    returning id into v_session_id;
  end if;

  insert into public.orders (
    restaurant_id,
    table_id,
    order_session_id,
    status,
    total_amount,
    notes
  )
  values (
    p_restaurant_id,
    p_table_id,
    v_session_id,
    'delivered',
    v_amount,
    null
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id,
    menu_item_id,
    name,
    price,
    quantity,
    notes
  )
  values (
    v_order_id,
    null,
    trim(p_name),
    v_amount,
    1,
    nullif(trim(coalesce(p_notes, '')), '')
  );

  update public.tables
  set status = 'ocupada'
  where id = p_table_id
    and restaurant_id = p_restaurant_id
    and status <> 'manutencao';

  return query select v_order_id, v_session_id, v_amount;
end;
$$;

create or replace function public.cancel_manual_table_item(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_order_id uuid
)
returns table (
  order_id uuid,
  table_released boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_remaining_orders integer;
  v_table_released boolean := false;
begin
  select o.order_session_id
    into v_session_id
  from public.orders o
  where o.id = p_order_id
    and o.restaurant_id = p_restaurant_id
    and o.table_id = p_table_id
    and exists (
      select 1
      from public.order_items oi
      where oi.order_id = o.id
        and oi.menu_item_id is null
    )
  for update;

  if v_session_id is null then
    raise exception 'MANUAL_ITEM_NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.order_items
  set cancelled_at = coalesce(cancelled_at, now())
  where order_id = p_order_id
    and menu_item_id is null;

  update public.orders
  set status = 'cancelled',
      total_amount = 0,
      updated_at = now()
  where id = p_order_id
    and restaurant_id = p_restaurant_id;

  select count(*)
    into v_remaining_orders
  from public.orders o
  where o.order_session_id = v_session_id
    and o.id <> p_order_id
    and o.status <> 'cancelled'
    and o.total_amount > 0;

  if v_remaining_orders = 0 then
    update public.order_sessions
    set closed_at = now()
    where id = v_session_id
      and closed_at is null;

    update public.tables
    set status = 'livre'
    where id = p_table_id
      and restaurant_id = p_restaurant_id
      and status <> 'manutencao';

    v_table_released := true;
  end if;

  return query select p_order_id, v_table_released;
end;
$$;

revoke all on function public.add_manual_table_item(uuid, uuid, text, numeric, text)
  from public, anon, authenticated;
grant execute on function public.add_manual_table_item(uuid, uuid, text, numeric, text)
  to service_role;

revoke all on function public.cancel_manual_table_item(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cancel_manual_table_item(uuid, uuid, uuid)
  to service_role;
