-- FORKO Printer — Etapa 2A: device auth + pairing + claim atômico
-- (2026-08-24).
--
-- Continuação da Etapa 1 (`0053_print_jobs_foundation.sql`). Ainda SEM
-- endpoints HTTP, UI, script do agente, MockAdapter, Realtime, ESC/POS,
-- heartbeat ou result/ACK — só a fundação de banco pra provar
-- device → pairing → claim atômico, exatamente como pedido.
--
-- Convenção de nome de função seguida (conferida contra o projeto antes de
-- escrever): verbo_substantivo, `snake_case`, mesmo padrão de
-- `close_table_bill`/`cancel_order_item`/`add_manual_table_item`.
--
-- `pgcrypto` já está habilitado desde `0001_initial_schema.sql` — usado
-- aqui só como referência de que `digest(valor, 'sha256')` já está
-- disponível; o hash em si é calculado no Next.js antes de chamar as
-- funções desta migration (nunca em texto puro chega ao banco em nenhum
-- caso — nem token, nem pairing code).

-- ── printer_devices ─────────────────────────────────────────────────────
create table public.printer_devices (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  -- Nunca o token em texto puro — só o hash. O valor real é gerado e
  -- entregue ao Printer 1 única vez pelo Next.js (fora do escopo desta
  -- migration); o banco nunca vê o token puro em nenhum momento.
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  -- Device revogado não pode fazer claim — aplicado dentro de
  -- `claim_next_print_job()` (`revoked_at is null`), não por RLS (RLS não
  -- se aplica aqui: a função roda como `security definer`, chamada só
  -- pelo backend, nunca direto do device).
  revoked_at timestamptz
);

create index printer_devices_restaurant_id_idx on public.printer_devices (restaurant_id);

alter table public.printer_devices enable row level security;

-- Só leitura, escopada por restaurante — mesmo padrão de `print_jobs`
-- (`0053`). Nenhuma policy de INSERT/UPDATE pra `anon`/`authenticated`:
-- a única forma de criar um device é via `pair_printer_device()`
-- (`security definer`, chamada pelo backend) — nunca direto do cliente.
create policy "select_own_printer_devices" on public.printer_devices
  for select
  using (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()));

-- ── printer_pairing_codes ───────────────────────────────────────────────
create table public.printer_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index printer_pairing_codes_restaurant_id_idx on public.printer_pairing_codes (restaurant_id);

alter table public.printer_pairing_codes enable row level security;

create policy "select_own_printer_pairing_codes" on public.printer_pairing_codes
  for select
  using (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()));

-- ── FK adiada da Etapa 1 ────────────────────────────────────────────────
-- Em `0053`, `print_jobs.claimed_by` nasceu nullable e SEM FK, porque
-- `printer_devices` ainda não existia. Agora existe — adiciona a FK.
-- `ON DELETE SET NULL` (preferência do dono, avaliada e mantida): um
-- device sendo apagado de vez não deveria arrastar/quebrar o histórico de
-- `print_jobs` que ele já processou — só perde a referência de QUEM
-- reivindicou, o job em si (e seu `document`/timestamps) continua intacto.
-- Revogação (`revoked_at`) é o caminho normal de "aposentar" um device
-- sem apagar nada; `ON DELETE` só entra em jogo numa exclusão de verdade.
alter table public.print_jobs
  add constraint print_jobs_claimed_by_fkey
  foreign key (claimed_by) references public.printer_devices (id) on delete set null;

-- ── pair_printer_device ─────────────────────────────────────────────────
-- Troca um pairing code válido por um `printer_devices` novo. Recebe o
-- HASH do código (calculado no Next.js) — nunca o valor puro. Também
-- recebe `p_token_hash` já pronto (o token puro é gerado no Next.js,
-- devolvido ao Printer 1 única vez, e SÓ o hash chega até aqui — a
-- função nunca vê nem devolve o token em texto puro, exatamente como
-- pedido).
create or replace function public.pair_printer_device(
  p_code_hash text,
  p_device_name text,
  p_token_hash text
)
returns table (
  device_id uuid,
  restaurant_id uuid,
  name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pairing printer_pairing_codes%rowtype;
  v_device_id uuid;
begin
  -- `for update` trava a linha do pairing code até o fim da transação —
  -- 2 tentativas simultâneas com o mesmo código nunca conseguem as duas
  -- passar da validação (a 2ª espera a 1ª terminar, e quando prossegue já
  -- encontra `used_at` preenchido, então falha na condição abaixo).
  select * into v_pairing
  from printer_pairing_codes
  where code_hash = p_code_hash
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'INVALID_OR_EXPIRED_PAIRING_CODE' using errcode = 'P0001';
  end if;

  insert into printer_devices (restaurant_id, name, token_hash)
  values (v_pairing.restaurant_id, p_device_name, p_token_hash)
  returning id into v_device_id;

  update printer_pairing_codes
  set used_at = now()
  where id = v_pairing.id;

  return query
  select v_device_id, v_pairing.restaurant_id, p_device_name;
end;
$$;

-- ── claim_next_print_job ────────────────────────────────────────────────
-- O claim atômico. Chamada pelo backend (nunca direto do executável do
-- Printer — ver seção de segurança da resposta) em nome de um device já
-- pareado e válido.
create or replace function public.claim_next_print_job(
  p_device_id uuid,
  p_lease_seconds integer default 60
)
returns setof print_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_job_id uuid;
begin
  -- Deriva o restaurante do PRÓPRIO device — nunca aceita um
  -- restaurant_id vindo de fora escolhendo a fila. Também é aqui que um
  -- device revogado é barrado: `revoked_at is null` faz parte da mesma
  -- condição que localiza o device.
  select restaurant_id into v_restaurant_id
  from printer_devices
  where id = p_device_id
    and revoked_at is null;

  if not found then
    raise exception 'INVALID_OR_REVOKED_DEVICE' using errcode = 'P0001';
  end if;

  -- Recuperação de lease expirado (mesma transação do claim, antes de
  -- buscar um candidato novo) — só do MESMO restaurante do device que
  -- está chamando. `attempt_count` NÃO muda aqui de propósito: a
  -- recuperação não é uma tentativa, é só destravar o job pra alguém
  -- tentar de novo — só a próxima reivindicação de verdade, mais abaixo,
  -- incrementa.
  update print_jobs
  set status = 'pending',
      claimed_by = null,
      claimed_at = null,
      lease_expires_at = null,
      updated_at = now()
  where restaurant_id = v_restaurant_id
    and status = 'processing'
    and lease_expires_at < now();

  -- Candidato: só `pending`, só pronto pra tentativa (`next_attempt_at`
  -- nulo ou já passou), só do restaurante do device, mais antigo primeiro.
  -- `FOR UPDATE SKIP LOCKED` é o que garante a atomicidade entre dois
  -- devices concorrentes — ver explicação detalhada na resposta.
  select id into v_job_id
  from print_jobs
  where restaurant_id = v_restaurant_id
    and status = 'pending'
    and (next_attempt_at is null or next_attempt_at <= now())
  order by created_at asc
  limit 1
  for update skip locked;

  if v_job_id is null then
    return; -- nenhuma linha — "nenhum job disponível", não um erro.
  end if;

  return query
  update print_jobs
  set status = 'processing',
      claimed_by = p_device_id,
      claimed_at = now(),
      lease_expires_at = now() + (p_lease_seconds || ' seconds')::interval,
      attempt_count = attempt_count + 1,
      updated_at = now()
  where id = v_job_id
  returning *;
end;
$$;
