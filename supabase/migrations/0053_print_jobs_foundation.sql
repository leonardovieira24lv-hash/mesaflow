-- FORKO Printer — Etapa 1: fundação de print_jobs (2026-08-24).
--
-- Aprovado após 2 rodadas de desenho (Fase 1: auditoria; Fase 2: arquitetura
-- e ajustes) — ver histórico da conversa. Esta migration cria SOMENTE a
-- Etapa 1: tabela + snapshot SQL + trigger. Nenhum device auth, claim, retry,
-- endpoint, agente ou UI ainda.
--
-- ── Decisão de atomicidade (ajuste da Fase 2) ──────────────────────────────
-- O documento (`document jsonb`) é montado por uma FUNÇÃO SQL
-- (`build_print_document_snapshot`), chamada DENTRO do mesmo trigger que
-- reage à mudança de status — nunca em TypeScript, nunca numa 2ª
-- transação/round-trip. Isso elimina de vez a janela de perda entre
-- "status virou preparing" e "job foi criado": ou os dois acontecem juntos,
-- na mesma transação, ou nenhum dos dois acontece.
--
-- ── Colunas usadas nesta migration, confirmadas contra o schema REAL antes
-- de escrever qualquer SQL (pedido explícito do dono) ──────────────────────
-- restaurants.name/timezone, tables.name, orders.id/created_at,
-- order_items.menu_item_id (nullable desde 0050 — null = item avulso),
-- order_items.name/quantity/notes/cancelled_at/selected_options/half_and_half.
-- Nenhuma coluna suposta — todas conferidas em 0001/0029/0034/0036/0039/0050.
--
-- ── Identificador humano do pedido ──────────────────────────────────────
-- O FORKO não tem número sequencial de pedido (só `orders.id`, uuid) — não
-- existe "Pedido #1042" nenhum lugar do sistema. Em vez de inventar um
-- campo que não existe, o snapshot usa os 8 primeiros caracteres do uuid,
-- maiúsculos, só como referência curta de exibição (`orderLabel`, ex.:
-- "PEDIDO #A3F91C02") — não é sequencial, não é único sozinho (só o uuid
-- completo é), é só uma etiqueta legível pro papel da cozinha.

create table public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  table_id uuid references public.tables (id) on delete set null,

  -- Só 'kitchen' tem uso real neste MVP (ajuste desta rodada: 'bar' fica
  -- de fora do roteamento, mas o CHECK já permite pra não exigir outra
  -- migration quando esse dia chegar).
  destination text not null default 'kitchen' check (destination in ('kitchen', 'bar')),

  document jsonb not null,

  status text not null default 'pending' check (status in ('pending', 'processing', 'printed', 'failed')),

  attempt_count integer not null default 0,
  next_attempt_at timestamptz,

  -- Campos de claim (Fase 2, item 5) — existem como colunas nullable
  -- desde já, mas SEM nenhuma duração de lease configurada nesta migration
  -- (ajuste explícito desta rodada: os 60s serão default da futura RPC
  -- `claim_next_print_job()`, não uma regra fixa aqui, onde ainda não
  -- existe operação de claim nenhuma).
  claimed_by uuid,
  claimed_at timestamptz,
  lease_expires_at timestamptz,

  last_error_code text,
  last_error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  printed_at timestamptz,

  -- Idempotência de verdade — 1 job por pedido+destino. Junto com o
  -- `ON CONFLICT DO NOTHING` da função abaixo, é a proteção contra
  -- duplicidade (ver função `create_print_job_on_kitchen_send`).
  unique (order_id, destination)
);

create index print_jobs_restaurant_id_idx on public.print_jobs (restaurant_id);
create index print_jobs_status_idx on public.print_jobs (status) where status in ('pending', 'processing');

alter table public.print_jobs enable row level security;

-- Mesmo padrão de RLS já usado em `orders`/`order_items` (0007) e na
-- fundação anterior de impressão (só leitura pela sessão normal; qualquer
-- escrita real, quando existir via API/RPC de agente, passa por
-- `security definer` ou cliente admin, nunca direto do navegador).
create policy "select_own_print_jobs" on public.print_jobs
  for select
  using (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()));

-- ── build_print_document_snapshot ──────────────────────────────────────
-- Monta o `PrintDocument` (ver `src/types/printing.ts`) inteiro em SQL —
-- nenhuma chamada a TypeScript, nenhum round-trip. Retorna `jsonb` na
-- MESMA forma que o tipo TypeScript espera ler depois.
--
-- Ajuste desta rodada: só itens ATIVOS entram (`cancelled_at is null`).
-- Um item cancelado ANTES do pedido ir pra cozinha não deveria aparecer
-- no papel de jeito nenhum (nem como "CANCELADO") — simplesmente não
-- existe pro cozinheiro. Cancelamento DEPOIS do envio é outro fluxo,
-- fora do escopo deste MVP (não tratado aqui).
create or replace function public.build_print_document_snapshot(p_order_id uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'header', jsonb_build_object(
      'restaurantName', r.name,
      'orderLabel', 'PEDIDO #' || upper(left(o.id::text, 8)),
      'tableLabel', 'MESA ' || t.name,
      'timeLabel', to_char(o.created_at at time zone r.timezone, 'HH24:MI')
    ),
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'quantity', oi.quantity,
            'name', oi.name,
            'isManualItem', oi.menu_item_id is null,
            'notes', (
              -- Meio a meio, se houver, sempre primeiro; depois cada
              -- opção escolhida (mesmo texto já usado no drawer da mesa,
              -- "{group_name}: {option_name}"); por último a observação
              -- livre do item, se houver. Um array de strings já prontas
              -- pra imprimir, uma por linha.
              (case when oi.half_and_half is not null then
                jsonb_build_array(
                  'Meio a meio: ' || (oi.half_and_half ->> 'flavor_a_name')
                    || ' / ' || (oi.half_and_half ->> 'flavor_b_name')
                )
              else '[]'::jsonb end)
              ||
              coalesce(
                (
                  select jsonb_agg((opt ->> 'group_name') || ': ' || (opt ->> 'option_name'))
                  from jsonb_array_elements(coalesce(oi.selected_options, '[]'::jsonb)) as opt
                ),
                '[]'::jsonb
              )
              ||
              (case when oi.notes is not null and trim(oi.notes) <> '' then
                jsonb_build_array(oi.notes)
              else '[]'::jsonb end)
            )
          )
          order by oi.id
        )
        from public.order_items oi
        where oi.order_id = o.id
          and oi.cancelled_at is null
      ),
      '[]'::jsonb
    ),
    'orderNotes', o.notes
  )
  from public.orders o
  join public.restaurants r on r.id = o.restaurant_id
  join public.tables t on t.id = o.table_id
  where o.id = p_order_id;
$$;

-- ── create_print_job_on_kitchen_send ───────────────────────────────────
-- O trigger em si. Dispara SÓ na transição exata pending→preparing (não em
-- toda atualização de `orders`) — condição no próprio `create trigger`
-- abaixo (`when`), então a função nem roda fora desse caso.
create or replace function public.create_print_job_on_kitchen_send()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.print_jobs (restaurant_id, order_id, table_id, destination, document, status)
  values (
    new.restaurant_id,
    new.id,
    new.table_id,
    'kitchen',
    public.build_print_document_snapshot(new.id),
    'pending'
  )
  -- 2ª camada de proteção contra duplicidade (a 1ª é a condição `when` do
  -- trigger em si) — mesmo se algo disparasse isto 2x pro mesmo pedido, a
  -- UNIQUE (order_id, destination) rejeita a 2ª tentativa SEM abortar a
  -- transação inteira (sem isto, a violação de UNIQUE derrubaria o UPDATE
  -- de status junto, o que seria exatamente o tipo de acoplamento que este
  -- projeto todo existe pra evitar).
  on conflict (order_id, destination) do nothing;

  return new;
end;
$$;

create trigger trg_create_print_job_on_kitchen_send
  after update on public.orders
  for each row
  when (old.status = 'pending' and new.status = 'preparing')
  execute function public.create_print_job_on_kitchen_send();
