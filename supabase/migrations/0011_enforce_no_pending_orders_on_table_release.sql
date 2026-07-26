-- MesaFlow — Correção do ciclo de vida dos pedidos
--
-- Causa raiz do estado inconsistente relatado ("mesa livre + pedido
-- pending"): a garantia de que "liberar uma mesa cancela qualquer pedido
-- ainda aberto" vivia inteiramente em `handleReleaseTable`
-- (`table-drawer.tsx`, Sprint "Correção do QR Code") — código de aplicação,
-- em JavaScript, rodando no navegador do admin. Por mais correto que esse
-- código esteja (e está: se o cancelamento de um pedido falha, a função
-- lança e NUNCA chega a liberar a mesa), uma garantia que só existe no
-- código de aplicação nunca é absoluta — ela deixa de valer se:
--   - a política de RLS de UPDATE em `orders` estiver ausente/quebrada
--     (a suspeita da investigação de infraestrutura) e o cancelamento
--     falhar de um jeito que o app não previu;
--   - alguém editar a linha da mesa direto pelo Table Editor do Supabase,
--     contornando o app inteiro;
--   - qualquer código futuro (um novo botão, uma ação em lote, um script de
--     manutenção) mudar o status da mesa sem passar por
--     `handleReleaseTable`.
--
-- A correção de verdade não é mais um pedaço de JavaScript prometendo se
-- comportar direito — é uma trigger no próprio Postgres, que roda dentro da
-- MESMA transação de qualquer UPDATE em `tables`, seja lá de onde ele vier.
--
-- `security definer` de propósito: a trigger precisa conseguir cancelar o
-- pedido mesmo que a política de RLS de UPDATE em `orders` esteja ausente
-- ou bloqueando a sessão que originou o UPDATE na mesa — senão a trigger
-- herdaria exatamente o mesmo problema que está tentando corrigir.
create or replace function public.enforce_no_pending_orders_on_table_release()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Só age na transição PARA "livre" — não em toda atualização da mesa.
  if new.status = 'livre' and (old.status is distinct from 'livre') then

    -- Qualquer pedido desta mesa que não tenha chegado a um status
    -- terminal é cancelado agora — a mesma decisão que "liberar mesmo
    -- assim" já tomava na tela, só que garantida aqui, sem depender de
    -- nenhum código de aplicação ter rodado antes.
    update public.orders
    set status = 'cancelled', updated_at = now()
    where table_id = new.id
      and status not in ('delivered', 'cancelled');

    -- Fecha qualquer order_session ainda aberta desta mesa, pelo mesmo
    -- motivo — evita a segunda metade do mesmo tipo de inconsistência
    -- (sessão aberta presa numa mesa livre).
    update public.order_sessions
    set closed_at = now()
    where table_id = new.id
      and closed_at is null;

  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_no_pending_orders_on_table_release on public.tables;

create trigger trg_enforce_no_pending_orders_on_table_release
  after update on public.tables
  for each row
  execute function public.enforce_no_pending_orders_on_table_release();

-- Correção retroativa do estado já inconsistente encontrado na
-- investigação (mesa(s) já liberada(s) com pedido ainda "pending"/
-- "preparing"/"ready" e/ou sessão ainda aberta) — a trigger acima só
-- previne casos NOVOS a partir de agora; isto aqui limpa o que já ficou
-- para trás.
update public.orders o
set status = 'cancelled', updated_at = now()
from public.tables t
where o.table_id = t.id
  and t.status = 'livre'
  and o.status not in ('delivered', 'cancelled');

update public.order_sessions os
set closed_at = now()
from public.tables t
where os.table_id = t.id
  and t.status = 'livre'
  and os.closed_at is null;
