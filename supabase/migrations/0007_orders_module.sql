-- MesaFlow — Módulo de Pedidos (Sprint 8)
--
-- 0004_dashboard_reads.sql já criou `select_own_orders` (o Dashboard
-- precisava contar pedidos antes do módulo existir de verdade). Esta sprint
-- implementa o módulo por completo (contrato seção 3 e 8) e precisa de:
--
--   1) UPDATE em `orders` — 8.3 (Atualizar Status do Pedido). A validação da
--      máquina de estados (`pending -> preparing -> ready -> delivered`,
--      com `cancelled` a partir de qualquer estado não-terminal) fica no
--      Route Handler, não numa constraint de banco — mesmo raciocínio já
--      registrado em 0001 (regra de negócio pertence ao módulo, não à
--      fundação do schema), já que a mensagem de erro `422
--      INVALID_STATUS_TRANSITION` precisa do `details` com estado atual e
--      solicitado (seção 8.3), algo que uma `check constraint` não expressa.
--
--   2) SELECT em `order_items` — necessário para 8.2 (Obter Detalhes do
--      Pedido, que retorna os itens completos) e para a Área do Cliente
--      revalidar preço/disponibilidade não depende de RLS (usa service
--      role, ver abaixo), mas o painel administrativo lê pela sessão do
--      usuário normalmente, então precisa da política.
--
--   3) UPDATE em `order_sessions` — ao atualizar um pedido para status
--      terminal (`delivered`/`cancelled`), o Route Handler pode encerrar a
--      sessão da mesa (`closed_at`); sem política de update, a operação
--      falharia silenciosamente sob RLS (0 linhas afetadas).
--
-- A CRIAÇÃO de pedido (3.3, `POST /api/v1/public/{slug}/orders`) e a
-- criação de `order_sessions` correspondente NÃO recebem política de INSERT
-- aqui: o endpoint público não tem `auth.uid()` (não há sessão de usuário —
-- contrato seção 1.6), então nenhuma política baseada em
-- `profiles.id = auth.uid()` conseguiria autorizar essa escrita de qualquer
-- forma. Assim como o Onboarding (seção 2.1) já registrado em
-- `src/lib/supabase/admin.ts`, o Route Handler público usa
-- `createAdminClient()` (service role, ignora RLS) e é o próprio código do
-- endpoint — não o Postgres — quem garante o isolamento por tenant, validando
-- explicitamente `slug`/`table_token` antes de qualquer escrita.

create policy "update_own_orders" on public.orders
  for update
  using (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()))
  with check (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()));

create policy "select_own_order_items" on public.order_items
  for select
  using (
    order_id in (
      select id from public.orders
      where restaurant_id in (select restaurant_id from public.profiles where id = auth.uid())
    )
  );

create policy "update_own_order_sessions" on public.order_sessions
  for update
  using (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()))
  with check (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()));

-- ── Realtime (contrato seção 1.10 / 3.3 / 8.3) ───────────────────────────────
-- Propaga INSERT/UPDATE em `orders` para dois canais:
--   `restaurant:{restaurant_id}:orders` (painel administrativo, Módulo 5/7)
--   `orders:id=eq.{id}` (acompanhamento do cliente, seção 3.4)
-- Ambos os canais são inscrições no *mesmo* replication slot da tabela
-- `orders` — o filtro por `restaurant_id` ou `id` é feito na inscrição do
-- client-side (`.channel(...).on('postgres_changes', { filter: ... })`),
-- não exige nenhuma configuração adicional aqui além de publicar a tabela.
alter publication supabase_realtime add table public.orders;
