-- MesaFlow/Forko — Sistema de Opcionais, Fase 1 (escolha única obrigatória).
--
-- Cobre: borda de pizza, ponto da carne, tamanho (P/M/G) — qualquer grupo
-- de opção onde o cliente escolhe exatamente 1 entre várias. Fases 2
-- (múltipla escolha com limite) e 3 (meio a meio) ficam pra depois,
-- deliberadamente fora do escopo desta migration.
--
-- Duas tabelas novas:
--
-- `option_groups` — o grupo em si (ex.: "Borda"). Vinculado a UMA
-- categoria inteira (todas as pizzas ganham "Borda" automaticamente) OU a
-- UM produto específico (só o X-Tudo tem "Ponto da carne") — nunca os
-- dois ao mesmo tempo, nunca nenhum dos dois. `check` garante isso no
-- próprio banco, não só na aplicação.
--
-- `option_group_items` — as opções dentro do grupo (ex.: "Catupiry",
-- "Sem borda"). `price_delta` pode ser zero (ex.: "Sem borda" não soma
-- nada) — nunca negativo nesta fase (desconto por opção fica pra decidir
-- depois, se algum dia fizer sentido).
--
-- `order_items.selected_options` — o que foi escolhido, gravado como
-- JSON no MOMENTO da compra (nome do grupo, nome da opção, preço
-- daquele instante) — não uma referência viva a `option_group_items`.
-- Mesmo motivo de sempre neste projeto: se o dono mudar o preço da
-- borda amanhã, pedido de ontem não pode mudar de valor sozinho.
create table public.option_groups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  category_id uuid references public.menu_categories(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint option_groups_exactly_one_target check (
    (category_id is not null and menu_item_id is null)
    or (category_id is null and menu_item_id is not null)
  )
);

create index option_groups_restaurant_id_idx on public.option_groups (restaurant_id);
create index option_groups_category_id_idx on public.option_groups (category_id) where category_id is not null;
create index option_groups_menu_item_id_idx on public.option_groups (menu_item_id) where menu_item_id is not null;

create table public.option_group_items (
  id uuid primary key default gen_random_uuid(),
  option_group_id uuid not null references public.option_groups(id) on delete cascade,
  name text not null,
  price_delta numeric not null default 0 check (price_delta >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index option_group_items_option_group_id_idx on public.option_group_items (option_group_id);

alter table public.order_items
  add column selected_options jsonb;

alter table public.option_groups enable row level security;
alter table public.option_group_items enable row level security;

-- SELECT: role-blind (mesmo padrão de `menu_categories`/`menu_items`,
-- `0004_dashboard_reads.sql`) — staff precisa ler isto pra tirar pedido
-- manual pela mesa, não só o owner.
create policy "select_own_option_groups" on public.option_groups
  for select
  using (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()));

create policy "select_own_option_group_items" on public.option_group_items
  for select
  using (
    exists (
      select 1
      from public.option_groups og
      where og.id = option_group_items.option_group_id
        and og.restaurant_id in (select restaurant_id from public.profiles where id = auth.uid())
    )
  );

-- Escrita: `role = 'owner'` já desde a criação — mesmo padrão corrigido
-- em `0031_restrict_menu_write_policies_to_owner.sql` pro Cardápio, sem
-- precisar de uma segunda migration de correção depois.
create policy "insert_own_option_groups" on public.option_groups
  for insert
  with check (
    restaurant_id in (select restaurant_id from public.profiles where id = auth.uid() and role = 'owner')
  );

create policy "update_own_option_groups" on public.option_groups
  for update
  using (
    restaurant_id in (select restaurant_id from public.profiles where id = auth.uid() and role = 'owner')
  )
  with check (
    restaurant_id in (select restaurant_id from public.profiles where id = auth.uid() and role = 'owner')
  );

create policy "delete_own_option_groups" on public.option_groups
  for delete
  using (
    restaurant_id in (select restaurant_id from public.profiles where id = auth.uid() and role = 'owner')
  );

create policy "insert_own_option_group_items" on public.option_group_items
  for insert
  with check (
    exists (
      select 1
      from public.option_groups og
      where og.id = option_group_items.option_group_id
        and og.restaurant_id in (select restaurant_id from public.profiles where id = auth.uid() and role = 'owner')
    )
  );

create policy "update_own_option_group_items" on public.option_group_items
  for update
  using (
    exists (
      select 1
      from public.option_groups og
      where og.id = option_group_items.option_group_id
        and og.restaurant_id in (select restaurant_id from public.profiles where id = auth.uid() and role = 'owner')
    )
  )
  with check (
    exists (
      select 1
      from public.option_groups og
      where og.id = option_group_items.option_group_id
        and og.restaurant_id in (select restaurant_id from public.profiles where id = auth.uid() and role = 'owner')
    )
  );

create policy "delete_own_option_group_items" on public.option_group_items
  for delete
  using (
    exists (
      select 1
      from public.option_groups og
      where og.id = option_group_items.option_group_id
        and og.restaurant_id in (select restaurant_id from public.profiles where id = auth.uid() and role = 'owner')
    )
  );
