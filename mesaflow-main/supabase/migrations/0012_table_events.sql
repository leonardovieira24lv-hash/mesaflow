-- MesaFlow — Eventos de Mesa: "Chamar garçom" / "Solicitar conta"
--
-- Especificação: docs/table-events-roadmap.md. Tabela nova, não um valor
-- novo no enum `tables.status` — é um evento pontual que se resolve
-- (aberto → reconhecido → resolvido), não um estado permanente da mesa
-- como `livre`/`ocupada`/`manutencao` (mesmo raciocínio já registrado para
-- `orders.status` vs `tables.status` em 0001).
--
-- O frontend já está preparado para isto desde a sprint anterior
-- (`TableCardAlert`, `deriveTableCardState` em
-- `src/lib/mesas/derive-table-card-state.ts`) — a lista `alerts` só
-- precisa deixar de chegar sempre vazia.

create table if not exists public.table_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid not null references public.tables (id) on delete cascade,
  type text not null check (type in ('waiter_call', 'bill_request')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id)
);

-- Índices para as duas consultas reais deste módulo: "todos os eventos em
-- aberto deste restaurante" (carga do Painel de Mesas, mesmo padrão de
-- `orders_restaurant_id_status_idx` da migration 0010) e "eventos em aberto
-- desta mesa" (usado ao decidir se uma mesa específica tem alerta).
create index if not exists table_events_restaurant_id_status_idx
  on public.table_events (restaurant_id, status);

create index if not exists table_events_table_id_status_idx
  on public.table_events (table_id, status);

alter table public.table_events enable row level security;

-- Leitura: admin autenticado só vê eventos do próprio restaurante — mesmo
-- padrão de `select_own_orders` (migration 0004).
create policy "select_own_table_events" on public.table_events
  for select
  using (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()));

-- Atualização (reconhecer/resolver): mesmo padrão de `update_own_orders`
-- (migration 0007). Igual ao endpoint de status de pedido, a ESCRITA real
-- (Route Handler) usa o cliente admin (service role) — esta política cobre
-- o caso de qualquer outro acesso via cliente autenticado normal, mas não é
-- o único mecanismo de autorização (mesma decisão arquitetural já tomada
-- para `orders`/`tables`, ver comentário em
-- `api/v1/orders/[id]/status/route.ts`).
create policy "update_own_table_events" on public.table_events
  for update
  using (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()))
  with check (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()));

-- Criação (chamar garçom / solicitar conta) NÃO recebe política de INSERT
-- aqui, de propósito: o endpoint público (`POST
-- /api/v1/public/{slug}/tables/{token}/call-waiter` e `.../request-bill`)
-- não tem `auth.uid()` — não há sessão de usuário —, então nenhuma política
-- baseada em `profiles.id = auth.uid()` conseguiria autorizar essa escrita
-- de qualquer forma. Mesmo padrão já registrado para `orders` (migration
-- 0007) e usado no onboarding: o Route Handler público usa
-- `createAdminClient()` (service role, ignora RLS) e é o próprio código do
-- endpoint quem garante o isolamento por tenant, validando explicitamente
-- `slug`/`table_token` antes de escrever.

-- Realtime — mesmo padrão de `orders` (migration 0007) e `tables`
-- (migration 0009): publica a tabela inteira; o filtro por `restaurant_id`
-- fica na inscrição client-side (`restaurantTableEventsChannel`,
-- `lib/realtime/channels.ts`).
alter publication supabase_realtime add table public.table_events;
