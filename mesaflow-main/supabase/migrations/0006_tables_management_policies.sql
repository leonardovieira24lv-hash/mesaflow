-- MesaFlow — Administração de Mesas (Sprint 7)
--
-- 0003_onboarding.sql já criou `select_own_tables` (leitura) e
-- `insert_own_tables_as_owner` (inserção em lote, restrita a `role = 'owner'`,
-- usada exclusivamente pelo fluxo de onboarding — seção 2.2 do contrato).
-- Esta sprint introduz o CRUD administrativo completo (seção 7), que:
--
--   1) precisa de UPDATE e DELETE em `tables`, ainda inexistentes;
--   2) precisa de um INSERT que NÃO seja restrito a `owner` — a seção 7.2
--      do contrato ("Adicionar Mesa") não impõe essa restrição, ao
--      contrário do onboarding. Mesmo padrão de raciocínio já registrado em
--      0005_menu_write_policies.sql para o Cardápio: só a seção 4.2
--      (Configurações) é `owner`-only, nenhum outro módulo de negócio é.
--
-- Políticas permissivas do Postgres se combinam com OR — adicionar esta
-- política de INSERT mais ampla não remove nem conflita com
-- `insert_own_tables_as_owner`; ela só passa a cobrir também o caso de um
-- usuário `staff` autenticado adicionando uma mesa pela tela administrativa.

create policy "insert_own_tables" on public.tables
  for insert
  with check (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()));

create policy "update_own_tables" on public.tables
  for update
  using (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()))
  with check (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()));

create policy "delete_own_tables" on public.tables
  for delete
  using (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()));

-- A exclusão de mesa (7.4) precisa checar se existe `order_session` em
-- aberto (`closed_at is null`) antes de excluir — regra de negócio explícita
-- do contrato, que não pode ser delegada à constraint de FK como no Cardápio
-- (5.4/6.5): `order_sessions.table_id` é `on delete cascade` (0001), não
-- `restrict`, então o banco nunca bloquearia a exclusão por si só; é o Route
-- Handler que precisa consultar `order_sessions` antes de excluir. Sem uma
-- política de `select`, essa consulta sempre voltaria vazia por causa do
-- RLS (mesmo raciocínio já registrado em 0004_dashboard_reads.sql),
-- mascarando sessões abertas reais e permitindo a exclusão indevida.
create policy "select_own_order_sessions" on public.order_sessions
  for select
  using (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()));
