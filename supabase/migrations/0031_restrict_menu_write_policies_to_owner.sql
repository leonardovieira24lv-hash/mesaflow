-- MesaFlow/Forko — Sprint 13.2: Fechar Lacuna de RLS do Cardápio.
--
-- Achado da Sprint 13.1 (auditoria): as policies de escrita de
-- `menu_categories`/`menu_items` (`0005_menu_write_policies.sql`) só
-- verificam `restaurant_id` — não verificam `role`. Isso foi uma decisão
-- correta NA ÉPOCA (Sprint 6, comentário original do próprio 0005: "não
-- restrito a owner"), porque só existia um papel então. A Fase 3 (Gestão
-- de Equipe) criou o papel `staff` e restringiu a escrita do Cardápio a
-- `owner` — mas só na camada de aplicação (`requireOwner()` nos Route
-- Handlers). A policy de RLS correspondente nunca foi atualizada pra
-- acompanhar. Resultado: uma requisição feita diretamente contra a API
-- REST do Supabase (sem passar pelo Next.js), usando a sessão de um
-- `staff`, não encontrava nenhuma barreira no banco.
--
-- Esta migration não altera `0005` (migrations antigas nunca são
-- editadas) — ela SUBSTITUI as 6 policies de escrita (INSERT/UPDATE/DELETE
-- × menu_categories/menu_items) por versões equivalentes que também
-- exigem `role = 'owner'`, seguindo EXATAMENTE o mesmo padrão já usado em
-- `update_own_restaurant_as_owner` (`0003_onboarding.sql`):
--
--   using (
--     id in (select restaurant_id from public.profiles where id = auth.uid() and role = 'owner')
--   )
--
-- (ali é `id` porque é a própria tabela `restaurants`; aqui é
-- `restaurant_id`, a FK nas tabelas filhas — mesma lógica, coluna
-- diferente). Nenhuma função nova, nenhum mecanismo de autorização
-- paralelo — reaproveita a mesma subconsulta em `profiles` que todo o
-- projeto já usa.
--
-- SELECT (`select_own_categories`/`select_own_items`, `0004_dashboard_reads.sql`)
-- NÃO é tocado por esta migration — staff continua lendo o cardápio
-- normalmente, só a escrita fica restrita.
--
-- UPDATE leva a MESMA condição em `using` (linha antiga) E em `with check`
-- (linha nova) — isso fecha de propósito o caso "owner tenta reatribuir
-- `restaurant_id` da linha para outro restaurante que não é dele": a nova
-- linha também precisa satisfazer "restaurant_id pertence a um
-- restaurante onde este usuário é owner", e como cada perfil só tem um
-- `restaurant_id`, isso só pode ser o próprio restaurante do usuário —
-- nunca o de outro (cross-tenant write bloqueado no INSERT, no UPDATE e
-- no DELETE, os três).

-- ── menu_categories ──────────────────────────────────────────────────
drop policy if exists "insert_own_menu_categories" on public.menu_categories;
drop policy if exists "update_own_menu_categories" on public.menu_categories;
drop policy if exists "delete_own_menu_categories" on public.menu_categories;

create policy "insert_own_menu_categories" on public.menu_categories
  for insert
  with check (
    restaurant_id in (select restaurant_id from public.profiles where id = auth.uid() and role = 'owner')
  );

create policy "update_own_menu_categories" on public.menu_categories
  for update
  using (
    restaurant_id in (select restaurant_id from public.profiles where id = auth.uid() and role = 'owner')
  )
  with check (
    restaurant_id in (select restaurant_id from public.profiles where id = auth.uid() and role = 'owner')
  );

create policy "delete_own_menu_categories" on public.menu_categories
  for delete
  using (
    restaurant_id in (select restaurant_id from public.profiles where id = auth.uid() and role = 'owner')
  );

-- ── menu_items ───────────────────────────────────────────────────────
drop policy if exists "insert_own_menu_items" on public.menu_items;
drop policy if exists "update_own_menu_items" on public.menu_items;
drop policy if exists "delete_own_menu_items" on public.menu_items;

create policy "insert_own_menu_items" on public.menu_items
  for insert
  with check (
    restaurant_id in (select restaurant_id from public.profiles where id = auth.uid() and role = 'owner')
  );

create policy "update_own_menu_items" on public.menu_items
  for update
  using (
    restaurant_id in (select restaurant_id from public.profiles where id = auth.uid() and role = 'owner')
  )
  with check (
    restaurant_id in (select restaurant_id from public.profiles where id = auth.uid() and role = 'owner')
  );

create policy "delete_own_menu_items" on public.menu_items
  for delete
  using (
    restaurant_id in (select restaurant_id from public.profiles where id = auth.uid() and role = 'owner')
  );
