-- FORKO — RPC V2 para item avulso com quantidade.
--
-- Usa um nome novo de propósito. A versão anterior mudou a assinatura de
-- `add_manual_table_item`; instalações/cache do PostgREST podiam continuar
-- resolvendo a assinatura anterior por alguns instantes. `v2` elimina
-- qualquer ambiguidade e mantém a função antiga intacta para compatibilidade.

create or replace function public.add_manual_table_item_v2(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_name text,
  p_amount numeric,
  p_quantity integer,
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
  v_unit_amount numeric(10,2);
  v_total numeric(10,2);
begin
  v_unit_amount := round(p_amount, 2);

  if nullif(trim(p_name), '') is null then
    raise exception 'INVALID_MANUAL_ITEM_NAME' using errcode = 'P0001';
  end if;

  if v_unit_amount <= 0 then
    raise exception 'INVALID_MANUAL_ITEM_AMOUNT' using errcode = 'P0001';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 999 then
    raise exception 'INVALID_MANUAL_ITEM_QUANTITY' using errcode = 'P0001';
  end if;

  v_total := round(v_unit_amount * p_quantity, 2);

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
    v_total,
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
    v_unit_amount,
    p_quantity,
    nullif(trim(coalesce(p_notes, '')), '')
  );

  update public.tables
  set status = 'ocupada'
  where id = p_table_id
    and restaurant_id = p_restaurant_id
    and status <> 'manutencao';

  return query
    select v_order_id, v_session_id, v_total;
end;
$$;

revoke all on function public.add_manual_table_item_v2(uuid, uuid, text, numeric, integer, text)
  from public, anon, authenticated;

grant execute on function public.add_manual_table_item_v2(uuid, uuid, text, numeric, integer, text)
  to service_role;

-- Solicita reload do schema do PostgREST para a RPC nova ficar disponível
-- imediatamente após a migration no ambiente Supabase.
notify pgrst, 'reload schema';
