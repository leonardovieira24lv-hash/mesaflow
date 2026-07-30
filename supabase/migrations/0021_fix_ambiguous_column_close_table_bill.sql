-- MesaFlow — Correção de Referência Ambígua em close_table_bill
-- (Sprint "Correção — SQLSTATE 42702", 2026-07-30)
--
-- Causa raiz confirmada pela instrumentação temporária (`console.error` +
-- erro completo devolvido na resposta): SQLSTATE 42702, "column reference
-- 'table_id' is ambiguous". A função declara `returns table (table_id uuid,
-- ...)` — em PL/pgSQL, os nomes de `returns table (...)` viram variáveis
-- automáticas no escopo da função inteira. A consulta que busca a sessão
-- aberta referenciava `table_id` sem qualificar de qual tabela, e o
-- Postgres não conseguia decidir entre a coluna `order_sessions.table_id`
-- e a variável de saída `table_id`.
--
-- Correção: todas as tabelas usadas na função ganharam alias, e toda
-- coluna passou a ser referenciada com esse alias — elimina a ambiguidade
-- em qualquer ponto da função, não só onde o erro foi observado. Nenhuma
-- mudança de lógica: mesmas 4 operações, na mesma ordem, dentro da mesma
-- transação (a `for update`/checagens/updates continuam idênticas).
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
begin
  -- `for update` trava a linha da sessão aberta desta mesa até o fim da
  -- transação — uma segunda chamada concorrente de fechamento pra mesma
  -- mesa espera aqui em vez de correr em paralelo com esta.
  select os.id into v_session_id
  from public.order_sessions os
  where os.table_id = p_table_id
    and os.restaurant_id = p_restaurant_id
    and os.closed_at is null
  for update;

  if v_session_id is null then
    raise exception 'Esta mesa não tem uma comanda aberta para fechar.' using errcode = 'P0001';
  end if;

  -- Fonte da verdade é sempre o banco: qualquer pedido desta sessão que
  -- ainda não estava num status terminal vira `delivered` aqui — não
  -- depende de nada que o frontend tenha (ou não) feito antes de chamar.
  update public.orders o
  set status = 'delivered', updated_at = now()
  where o.order_session_id = v_session_id
    and o.status not in ('delivered', 'cancelled');

  update public.order_sessions os
  set closed_at = now(), payment_method = p_payment_method
  where os.id = v_session_id;

  -- Dispara `trg_enforce_no_pending_orders_on_table_release` — dentro
  -- desta mesma transação, como já era desde a 0019.
  update public.tables t
  set status = 'livre'
  where t.id = p_table_id
    and t.restaurant_id = p_restaurant_id;

  return query
  select t.id, t.name, t.status, t.qr_token
  from public.tables t
  where t.id = p_table_id;
end;
$$;
