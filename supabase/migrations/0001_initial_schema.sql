-- MesaFlow — schema inicial (v1)
-- Espelha as entidades do contrato de API (api-contracts-v1.md).
-- Esta migration cria apenas a ESTRUTURA (tabelas, constraints, RLS).
-- Nenhuma lógica de negócio (funções, triggers de regra) é criada aqui —
-- isso é implementado junto com cada módulo, na próxima fase.

create extension if not exists "pgcrypto";

-- ── restaurants ─────────────────────────────────────────────────────────────
create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'onboarding' check (status in ('onboarding', 'active')),
  qr_codes_printed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── profiles (vínculo auth.users <-> restaurants) ───────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);

-- ── menu_categories ──────────────────────────────────────────────────────────
create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

-- ── menu_items ───────────────────────────────────────────────────────────────
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid not null references public.menu_categories (id) on delete restrict,
  name text not null,
  description text,
  price numeric(10, 2) not null check (price > 0),
  image_url text,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  unique (category_id, name)
);

-- ── tables ───────────────────────────────────────────────────────────────────
create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  status text not null default 'livre' check (status in ('livre', 'ocupada', 'manutencao')),
  qr_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

-- ── order_sessions ───────────────────────────────────────────────────────────
create table if not exists public.order_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid not null references public.tables (id) on delete cascade,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

-- ── orders ───────────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid not null references public.tables (id) on delete restrict,
  order_session_id uuid references public.order_sessions (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'preparing', 'ready', 'delivered', 'cancelled')),
  total_amount numeric(10, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── order_items ──────────────────────────────────────────────────────────────
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid not null references public.menu_items (id) on delete restrict,
  name text not null, -- snapshot do nome no momento do pedido
  price numeric(10, 2) not null, -- snapshot do preço no momento do pedido
  quantity integer not null check (quantity > 0),
  notes text
);

-- ── Row Level Security ───────────────────────────────────────────────────────
-- Linha de defesa principal (contrato seção 1.6): cada tabela só expõe linhas
-- do restaurant_id do usuário autenticado. As políticas de escrita detalhadas
-- (quem pode inserir/atualizar o quê) são refinadas módulo a módulo; aqui só
-- fica a fundação de isolamento por tenant.

alter table public.restaurants enable row level security;
alter table public.profiles enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.tables enable row level security;
alter table public.order_sessions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Placeholder de política de leitura por tenant (a refinar por módulo/tabela).
-- Exemplo de padrão a seguir nas próximas migrations:
--
-- create policy "select_own_restaurant" on public.menu_categories
--   for select using (
--     restaurant_id in (select restaurant_id from public.profiles where id = auth.uid())
--   );
