-- MesaFlow — Cardápio: Categorias e Produtos (Sprint 6)
--
-- A migration 0004 (leituras do Dashboard) só cobre `select` em
-- `menu_categories`/`menu_items`/`orders` — suficiente para os contadores,
-- mas esta sprint introduz o CRUD de verdade (contrato seções 5 e 6), que
-- precisa gravar. Sem políticas de `insert`/`update`/`delete`, toda escrita
-- autenticada seria bloqueada pelo RLS (0 linhas afetadas, sem erro
-- explícito) mesmo com o Route Handler correto.
--
-- Autorização igual à da seção 5/6 do contrato: qualquer usuário autenticado
-- do restaurante (não restrito a `owner`) — o cardápio não é uma área
-- administrativa sensível como Configurações (seção 4.2), então não repete
-- o padrão `role = 'owner'` usado em `update_own_restaurant_as_owner`.
--
-- Exclusão (5.4/6.5) não precisa de lógica extra aqui: a constraint
-- `on delete restrict` já criada em 0001 (menu_items.category_id e
-- order_items.menu_item_id) barra a exclusão de categoria com produtos ou
-- produto com histórico de pedidos: o Route Handler apenas captura essa
-- violação (`23503`) e responde `409 CONFLICT` com a orientação certa, em
-- vez de duplicar essa checagem em uma política de RLS separada.

create policy "insert_own_menu_categories" on public.menu_categories
  for insert
  with check (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()));

create policy "update_own_menu_categories" on public.menu_categories
  for update
  using (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()))
  with check (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()));

create policy "delete_own_menu_categories" on public.menu_categories
  for delete
  using (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()));

create policy "insert_own_menu_items" on public.menu_items
  for insert
  with check (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()));

create policy "update_own_menu_items" on public.menu_items
  for update
  using (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()))
  with check (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()));

create policy "delete_own_menu_items" on public.menu_items
  for delete
  using (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()));
