-- MesaFlow — Fechamento de Conta Atômico (Sprint "Correção — Fechamento
-- de Conta Não-Atômico", 2026-07-30)
--
-- Causa raiz investigada e confirmada por leitura de código: a rota
-- `PATCH /api/v1/tables/{id}/close-bill` fechava a `order_session` e
-- liberava a mesa em DUAS chamadas `.update()` separadas — cada uma sua
-- própria transação no Postgres. Se a segunda (liberar a mesa) falhasse
-- por qualquer motivo — o suspeito concreto é a trigger
-- `trg_enforce_no_pending_orders_on_table_release`
-- (`0011_enforce_no_pending_orders_on_table_release.sql`), que roda
-- dentro da MESMA transação do `UPDATE tables` e pode abortá-la — a
-- primeira chamada já estava commitada: a comanda ficava fechada
-- (`closed_at` preenchido) para sempre, mas a mesa nunca saía de
-- "ocupada". Uma tentativa seguinte de "Fechar conta" não encontrava
-- mais sessão aberta nenhuma ("Esta mesa não tem uma comanda aberta para
-- fechar") — a mensagem estava certa, o estado é que tinha ficado
-- inconsistente antes dela aparecer.
--
-- Correção: unir as duas escritas (fechar sessão + liberar mesa) numa
-- única função `security definer` — uma chamada RPC é uma única
-- transação; ou as duas mudanças acontecem juntas, ou nenhuma acontece
-- (incluindo a trigger da 0011, que passa a rodar dentro desta mesma
-- transação também). Mesmo padrão de segurança já usado pela própria
-- trigger da 0011: `security definer` para não depender de RLS de
-- UPDATE em nenhuma das tabelas envolvidas.
--
-- Validações que já existiam na rota (sessão aberta existe / nenhum
-- pedido da sessão ainda não-terminal) foram movidas pra dentro da
-- função, na mesma transação — não mudam de comportamento, só de lugar.
create or replace function public.close_table_bill(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_payment_method text
)
returns table (
  table_id uuid,
  table_name text,
  table_status text,
  table_qr_token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_still_open boolean;
begin
  -- `for update` trava a linha da sessão aberta desta mesa até o fim da
  -- transação — uma segunda chamada concorrente de fechamento pra mesma
  -- mesa espera aqui em vez de correr em paralelo com esta.
  select id into v_session_id
  from public.order_sessions
  where table_id = p_table_id
    and restaurant_id = p_restaurant_id
    and closed_at is null
  for update;

  if v_session_id is null then
    raise exception 'Esta mesa não tem uma comanda aberta para fechar.' using errcode = 'P0001';
  end if;

  select exists (
    select 1 from public.orders
    where order_session_id = v_session_id
      and status not in ('delivered', 'cancelled')
  ) into v_still_open;

  if v_still_open then
    raise exception 'Ainda há pedidos em aberto nesta mesa. Finalize-os antes de fechar a conta.' using errcode = 'P0002';
  end if;

  update public.order_sessions
  set closed_at = now(), payment_method = p_payment_method
  where id = v_session_id;

  -- Dispara `trg_enforce_no_pending_orders_on_table_release` — agora
  -- dentro desta mesma transação: se ela levantar exceção, tudo acima
  -- (fechamento da sessão incluído) desfaz junto, em vez de ficar pela
  -- metade.
  update public.tables
  set status = 'livre'
  where id = p_table_id
    and restaurant_id = p_restaurant_id;

  return query
  select t.id, t.name, t.status, t.qr_token
  from public.tables t
  where t.id = p_table_id;
end;
$$;
