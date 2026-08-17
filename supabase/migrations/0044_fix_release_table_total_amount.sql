-- MesaFlow/Forko — Correção: total_amount não zerava ao cancelar pedido
-- via "liberar mesa com pedido ainda ativo".
--
-- Achado na auditoria de segurança/lógica (2026-08-15), corrigido agora
-- (2026-08-17). Existem 2 caminhos que cancelam pedido no sistema:
--
--   1. `cancel_order_item` (migration 0038) — zera `total_amount`
--      corretamente, recalculando a partir dos itens não-cancelados.
--   2. `enforce_no_pending_orders_on_table_release` (migration 0011,
--      dispara quando uma mesa vira "livre" com pedido ainda pending/
--      preparing/ready) — só mudava `orders.status` pra `cancelled`,
--      NUNCA zerava `total_amount`. Pedido cancelado por esse caminho
--      ficava com status "cancelled" mas o valor antigo ainda gravado.
--
-- Por que não vazava até agora: Caixa filtra `status != 'cancelled'` nas
-- somas, e a sessão de mesa fecha junto (mesmo trigger 0011), então o
-- dashboard de "valor em aberto" também não pegava. Mas era uma
-- pegadinha esperando acontecer pra qualquer código futuro que somasse
-- `total_amount` sem excluir cancelados primeiro — corrigido na raiz
-- agora, não só nos lugares que já sabem filtrar.
--
-- Correção: mesma function de 0011, só acrescentando `total_amount = 0`
-- no UPDATE que já cancela os pedidos — nenhuma outra lógica muda.
create or replace function public.enforce_no_pending_orders_on_table_release()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'livre' and (old.status is distinct from 'livre') then

    -- Correção desta migration: `total_amount = 0` adicionado — pedido
    -- cancelado por este caminho passa a zerar o valor, igual
    -- `cancel_order_item` já faz pro caso de cancelar item a item.
    update public.orders
    set status = 'cancelled', total_amount = 0, updated_at = now()
    where table_id = new.id
      and status not in ('delivered', 'cancelled');

    update public.order_sessions
    set closed_at = now()
    where table_id = new.id
      and closed_at is null;

  end if;

  return new;
end;
$$;

-- Backfill único: pedidos que já foram cancelados por esse caminho ANTES
-- desta correção (status = 'cancelled', mas total_amount ainda com o
-- valor antigo, não-zero) — zerados agora. Pedidos cancelados via
-- `cancel_order_item` não são tocados (já estão corretos desde a 0038).
update public.orders
set total_amount = 0
where status = 'cancelled'
  and total_amount <> 0;
