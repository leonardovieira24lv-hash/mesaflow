-- MesaFlow — Limpeza Completa do Ambiente de Testes
--
-- Substitui/completa `0015_cleanup_legacy_menu_data.sql`, que não chegou a
-- apagar nada: ela tentava `DELETE FROM menu_items` direto, mas 4 produtos
-- (`misndnndn`, `x dog`, `x tudo super`, `jabta`) já tinham `order_items` de
-- pedidos de teste apontando pra eles (`order_items.menu_item_id` é
-- `on delete restrict`), o que disparou uma violação de foreign key e
-- reverteu a transação inteira automaticamente — nenhuma linha chegou a
-- ser removida por ela.
--
-- Esta migration NÃO altera schema, índice, constraint, RLS ou código da
-- aplicação — só dados. Ordem obrigatória pela cadeia real de FKs
-- (`supabase/migrations/0001_initial_schema.sql`):
--   order_items.order_id      → orders.id          (on delete cascade)
--   order_items.menu_item_id  → menu_items.id      (on delete restrict)
--   menu_items.category_id    → menu_categories.id (on delete restrict)
-- Por isso: order_items primeiro, depois orders, depois menu_items, depois
-- menu_categories. `order_sessions` fica de fora — não bloqueia nada dessa
-- cadeia e não foi pedido.
--
-- Tudo numa única transação: qualquer erro no meio desfaz tudo sozinho,
-- sem precisar de rollback manual (comportamento padrão do Postgres dentro
-- de begin/commit).
--
-- Idempotente: são todos `DELETE` sem `WHERE`, então rodar de novo depois
-- de já estar limpo só apaga 0 linhas em cada tabela — não falha.
begin;

-- 1) order_items primeiro: depende de orders (cascade) e de menu_items
--    (restrict) — precisa sair da frente dos dois.
delete from public.order_items;

-- 2) orders: já não tem nenhum order_items apontando pra ela.
delete from public.orders;

-- 3) menu_items: já não tem nenhum order_items apontando pra ele.
delete from public.menu_items;

-- 4) menu_categories: já não tem nenhum menu_items apontando pra ela.
delete from public.menu_categories;

-- Confirmação de que o banco ficou limpo (aparece no log/saída do editor
-- SQL ao rodar a migration) — e uma segunda garantia: se por qualquer
-- motivo sobrar alguma linha em qualquer uma das quatro tabelas, a
-- transação inteira é desfeita (raise exception força o rollback).
do $$
declare
  remaining_order_items integer;
  remaining_orders integer;
  remaining_items integer;
  remaining_categories integer;
begin
  select count(*) into remaining_order_items from public.order_items;
  select count(*) into remaining_orders from public.orders;
  select count(*) into remaining_items from public.menu_items;
  select count(*) into remaining_categories from public.menu_categories;

  raise notice 'Limpeza concluída — order_items: %, orders: %, menu_items: %, menu_categories: %',
    remaining_order_items, remaining_orders, remaining_items, remaining_categories;

  if remaining_order_items > 0 or remaining_orders > 0 or remaining_items > 0 or remaining_categories > 0 then
    raise exception 'Limpeza incompleta: order_items=%, orders=%, menu_items=%, menu_categories=%.',
      remaining_order_items, remaining_orders, remaining_items, remaining_categories;
  end if;
end $$;

commit;
