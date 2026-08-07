-- MesaFlow — Fechamento de Caixa: tabela de snapshots permanentes
-- (Sprint 2 "Persistência do Fechamento de Caixa", 2026-08-06)
--
-- Cada linha é o resultado de UM fechamento de caixa confirmado pelo
-- usuário: os valores são gravados no momento do fechamento e nunca
-- recalculados depois — ao contrário de `getCashierData`
-- (`lib/cashier/queries.ts`), que soma `orders`/`order_sessions` ao vivo
-- toda vez que a tela é aberta. Sem esta tabela, um fechamento "antigo"
-- mudaria de valor se um pedido daquele período fosse editado/estornado
-- no futuro — o que a Sprint 2 proíbe explicitamente.
--
-- `period_from`/`period_to` guardam o intervalo já resolvido (mesmo
-- formato de `resolveCashierDateRange`, `lib/cashier/queries.ts`), não o
-- enum cru: "hoje" só faz sentido no instante do fechamento, então vira
-- timestamp absoluto aqui, congelado junto com o resto do snapshot.
-- `period_type` fica só como rótulo de exibição (ex.: reconstituir "Hoje"
-- num histórico futuro), nunca é usado para recalcular nada.
create table public.cashier_closings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id),
  closed_by uuid not null references public.profiles(id),
  closed_at timestamptz not null default now(),
  period_type text not null,
  period_from timestamptz not null,
  period_to timestamptz not null,
  revenue numeric not null,
  closed_sessions_count integer not null,
  average_ticket numeric not null,
  tables_served_count integer not null,
  observations text
);

-- Suporta a consulta mais óbvia de qualquer funcionalidade futura de
-- histórico: "fechamentos deste restaurante, mais recentes primeiro".
create index cashier_closings_restaurant_closed_at_idx
  on public.cashier_closings (restaurant_id, closed_at desc);

alter table public.cashier_closings enable row level security;

-- ATENÇÃO: policy escrita por inferência do padrão descrito em
-- `requireSession()` (`lib/api/auth.ts`, "a primeira camada é o RLS"),
-- sem ter visto nenhuma policy já existente no projeto para confirmar a
-- convenção exata. Validar contra uma migration real com policy de
-- `select` antes de aplicar — o formato abaixo é o mais comum
-- (restringir por `restaurant_id` do perfil autenticado), mas o nome da
-- policy e a forma exata da subquery podem divergir do padrão do projeto.
--
-- Nenhuma policy de insert/update/delete de propósito: a única escrita
-- permitida é a de dentro de `close_cashier` (`security definer`, roda
-- como o dono da function, não como o usuário autenticado) — para
-- qualquer client autenticado direto, a tabela é efetivamente só-leitura,
-- o que já reforça "fechamentos antigos não podem ser modificados".
create policy "cashier_closings_select_own_restaurant"
  on public.cashier_closings
  for select
  using (
    restaurant_id in (
      select p.restaurant_id from public.profiles p where p.id = auth.uid()
    )
  );
