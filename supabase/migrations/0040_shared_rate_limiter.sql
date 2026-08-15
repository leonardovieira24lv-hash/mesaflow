-- MesaFlow/Forko — Rate limiter compartilhado (2026-08-15).
--
-- Correção de confiabilidade identificada em auditoria: o limitador
-- (`lib/api/rate-limit.ts`) vivia inteiramente em memória (`Map` do
-- processo Node) — na Vercel (serverless), cada instância da função tem
-- seu próprio processo, logo seu próprio contador. 20 instâncias
-- concorrentes = 20 limites de `N` requisições cada, não um limite de `N`
-- de verdade. O próprio arquivo já documentava isso como pendência
-- conhecida, não escondida.
--
-- Decisão (confirmada com o dono): reaproveitar o Postgres já usado pelo
-- projeto em vez de introduzir Redis/Upstash — sem serviço novo pra
-- gerenciar, ao custo de uma ida a mais ao banco por requisição
-- protegida (aceitável no volume atual).
--
-- `check_rate_limit`: mesmo algoritmo de "janela deslizante" que já
-- existia em JS (pondera a janela anterior proporcionalmente, evita a
-- rajada de 2×limit na borda entre duas janelas fixas) — só que agora
-- inteiro dentro de uma função Postgres, protegida por
-- `select ... for update`: essa linha trava enquanto a função roda,
-- então duas requisições concorrentes pra MESMA chave (de instâncias
-- diferentes da Vercel, não importa) nunca leem o mesmo valor "por baixo
-- do pano" — a segunda espera a primeira terminar antes de decidir.
create table public.rate_limit_hits (
  key text primary key,
  window_ms integer not null,
  current_window_started_at timestamptz not null,
  current_window_count integer not null default 0,
  previous_window_count integer not null default 0
);

-- RLS ligado, sem nenhuma policy — mesmo padrão de "toda tabela tem RLS"
-- já confirmado no resto do projeto (auditoria 2026-08-15). Acesso só via
-- `check_rate_limit` (security definer) ou o cliente admin (service
-- role), nunca direto do cliente autenticado comum.
alter table public.rate_limit_hits enable row level security;

create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_ms integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.rate_limit_hits%rowtype;
  v_ms_since_start double precision;
  v_fraction_elapsed double precision;
  v_estimated_count double precision;
begin
  -- Limpeza oportunista, sem cron/job separado: 1% das chamadas varre e
  -- descarta chaves inativas há mais de 1 dia — mesmo raciocínio do
  -- `cleanupExpiredEntries` que já existia em JS, só que sem precisar de
  -- infraestrutura de agendamento nova.
  if random() < 0.01 then
    delete from public.rate_limit_hits where current_window_started_at < v_now - interval '1 day';
  end if;

  select * into v_row from public.rate_limit_hits where key = p_key for update;

  if not found then
    insert into public.rate_limit_hits (key, window_ms, current_window_started_at, current_window_count, previous_window_count)
    values (p_key, p_window_ms, v_now, 1, 0);
    return true;
  end if;

  v_ms_since_start := extract(epoch from (v_now - v_row.current_window_started_at)) * 1000;

  if v_ms_since_start >= v_row.window_ms * 2 then
    -- Tão velha que não há nada "deslizando" de verdade — reinicia do zero.
    update public.rate_limit_hits
    set current_window_started_at = v_now, current_window_count = 1, previous_window_count = 0, window_ms = p_window_ms
    where key = p_key;
    return true;
  end if;

  if v_ms_since_start >= v_row.window_ms then
    -- A janela atual acabou de virar — vira "anterior" (ainda pesa
    -- proporcionalmente), uma nova janela começa vazia.
    v_row.previous_window_count := v_row.current_window_count;
    v_row.current_window_count := 0;
    v_row.current_window_started_at := v_row.current_window_started_at + make_interval(secs => v_row.window_ms / 1000.0);
  end if;

  v_fraction_elapsed := extract(epoch from (v_now - v_row.current_window_started_at)) * 1000 / v_row.window_ms;
  v_estimated_count := v_row.current_window_count + v_row.previous_window_count * (1 - v_fraction_elapsed);

  if v_estimated_count >= p_limit then
    -- Persiste o estado da janela (pode ter "virado" acima) mesmo
    -- rejeitando — senão a próxima chamada recalcularia a virada de novo
    -- a partir do valor antigo, incorretamente.
    update public.rate_limit_hits
    set current_window_started_at = v_row.current_window_started_at,
        current_window_count = v_row.current_window_count,
        previous_window_count = v_row.previous_window_count,
        window_ms = p_window_ms
    where key = p_key;
    return false;
  end if;

  update public.rate_limit_hits
  set current_window_started_at = v_row.current_window_started_at,
      current_window_count = v_row.current_window_count + 1,
      previous_window_count = v_row.previous_window_count,
      window_ms = p_window_ms
  where key = p_key;

  return true;
end;
$$;
