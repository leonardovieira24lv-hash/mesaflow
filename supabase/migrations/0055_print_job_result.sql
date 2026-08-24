-- FORKO Printer — Etapa 2C: resultado do trabalho de impressão
-- (report_print_job_result) (2026-08-24).
--
-- Continuação de 0053 (fundação) + 0054 (device auth + claim). Toda a
-- lógica crítica de concorrência/estado fica nesta função — nenhum
-- endpoint HTTP faz múltiplos UPDATEs espalhados (pedido explícito).
--
-- ── Decisões de desenho, com justificativa ──────────────────────────────
--
-- Campos de claim (`claimed_by`/`claimed_at`) em sucesso/falha TERMINAL:
-- PRESERVADOS, não limpos. Justificativa: "quem processou este job" é
-- informação de auditoria com valor real (ex.: depurar "por que a
-- impressora X está falhando toda hora" exige saber qual device tentou).
-- Só `lease_expires_at` é limpo nesses 2 casos — o lease deixa de ter
-- sentido assim que o job vira terminal, não existe mais nada
-- "expirando". Em falha RETRYABLE (volta pra `pending`), os 3 campos SÃO
-- limpos — aqui sim é obrigatório (não só estilo): é o que garante que o
-- cenário "Device A demora, lease expira, Device B reivindica, ACK
-- atrasado de A chega" (cenário G do pedido) seja recusado com segurança
-- — ver o `if` de autorização abaixo.
--
-- `attempt_count` NUNCA muda aqui — já foi incrementado no CLAIM
-- (`0054`). O backoff usa o valor atual dele.

create or replace function public.report_print_job_result(
  p_job_id uuid,
  p_device_id uuid,
  p_status text,               -- 'printed' | 'failed'
  p_retryable boolean default false,
  p_error_code text default null,
  p_error_message text default null
)
returns setof print_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_job print_jobs%rowtype;
  v_backoff_seconds integer;
  v_max_attempts constant integer := 5;
begin
  if p_status not in ('printed', 'failed') then
    raise exception 'INVALID_RESULT_STATUS' using errcode = 'P0001';
  end if;

  select restaurant_id into v_restaurant_id
  from printer_devices
  where id = p_device_id
    and revoked_at is null;

  if not found then
    raise exception 'INVALID_OR_REVOKED_DEVICE' using errcode = 'P0001';
  end if;

  select * into v_job
  from print_jobs
  where id = p_job_id
  for update;

  if not found or v_job.restaurant_id <> v_restaurant_id then
    raise exception 'JOB_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  -- ── ACK idempotente (cenário D do pedido) ────────────────────────────
  if v_job.status in ('printed', 'failed')
     and v_job.claimed_by = p_device_id
     and v_job.status = p_status then
    return next v_job;
    return;
  end if;

  -- ── Autorização real (cenários G e H do pedido) ──────────────────────
  if v_job.status <> 'processing' or v_job.claimed_by <> p_device_id then
    raise exception 'JOB_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  if p_status = 'printed' then
    return query
    update print_jobs
    set status = 'printed',
        printed_at = now(),
        lease_expires_at = null,
        last_error_code = null,
        last_error_message = null,
        updated_at = now()
    where id = p_job_id
    returning *;
    return;
  end if;

  -- p_status = 'failed' a partir daqui.
  if p_retryable and v_job.attempt_count < v_max_attempts then
    v_backoff_seconds := case v_job.attempt_count
      when 1 then 15
      when 2 then 30
      when 3 then 60
      when 4 then 120
      else 300
    end;

    return query
    update print_jobs
    set status = 'pending',
        claimed_by = null,
        claimed_at = null,
        lease_expires_at = null,
        next_attempt_at = now() + (v_backoff_seconds || ' seconds')::interval,
        last_error_code = p_error_code,
        last_error_message = p_error_message,
        updated_at = now()
    where id = p_job_id
    returning *;
    return;
  end if;

  return query
  update print_jobs
  set status = 'failed',
      lease_expires_at = null,
      last_error_code = case
        when p_retryable and v_job.attempt_count >= v_max_attempts then 'max_attempts_exceeded'
        else p_error_code
      end,
      last_error_message = p_error_message,
      updated_at = now()
  where id = p_job_id
  returning *;
end;
$$;
