-- MesaFlow — Limpeza de Dados Antigos de Teste (menu_items / menu_categories)
--
-- Esta migration NÃO altera schema, índice, constraint, RLS ou código da
-- aplicação — é só uma limpeza de dados, pedida para remover categorias e
-- produtos criados antes da implementação atual de gerenciamento de
-- Cardápio (ficaram inconsistentes com o fluxo novo).
--
-- Ordem obrigatória por causa das foreign keys existentes (ambas
-- `on delete restrict`, migration 0001):
--   1) `menu_items.category_id` → `menu_categories.id`
--   2) `order_items.menu_item_id` → `menu_items.id`
-- Por isso `menu_items` é apagado antes de `menu_categories` (pedido
-- explícito) — mas existe uma segunda dependência que o pedido original não
-- mencionou: se algum desses produtos antigos já apareceu em algum pedido
-- de teste, `order_items` ainda aponta para ele, e o `DELETE` abaixo vai
-- falhar com violação de foreign key (comportamento intencional da mesma
-- regra que a Sprint "Exclusão Lógica de Produtos" implementou — preserva
-- histórico de pedidos). Esta migration NÃO apaga `orders`/`order_items`
-- silenciosamente para contornar isso — seria apagar histórico de pedidos
-- sem ter sido pedido, uma ação bem maior e irreversível. Antes de rodar,
-- confira se isso vai acontecer:
--
--   select mi.id, mi.name
--   from public.menu_items mi
--   where exists (select 1 from public.order_items oi where oi.menu_item_id = mi.id);
--
-- Se essa consulta não retornar nenhuma linha, o DELETE abaixo roda limpo.
-- Se retornar linhas, é preciso decidir antes: ou esses produtos ficam de
-- fora desta limpeza (continuam existindo, agora arquivados ou não), ou
-- você confirma que também quer apagar os pedidos de teste que os usam —
-- nesse caso me avise para eu escrever essa parte à parte, com o mesmo
-- cuidado de ordem de FKs (order_items antes de orders).
--
-- Idempotente: `DELETE FROM tabela` sem `WHERE` (ou com uma condição que
-- passa a não bater mais nada depois da primeira execução) não falha ao
-- rodar de novo — a segunda execução só apaga 0 linhas.
begin;

delete from public.menu_items;
delete from public.menu_categories;

-- Confirmação de que o banco ficou limpo (aparece no log/saída do editor
-- SQL ao rodar a migration).
do $$
declare
  remaining_items integer;
  remaining_categories integer;
begin
  select count(*) into remaining_items from public.menu_items;
  select count(*) into remaining_categories from public.menu_categories;

  raise notice 'Limpeza concluída — menu_items restantes: %, menu_categories restantes: %', remaining_items, remaining_categories;

  if remaining_items > 0 or remaining_categories > 0 then
    raise exception 'Limpeza incompleta: ainda restam % produto(s) e % categoria(s).', remaining_items, remaining_categories;
  end if;
end $$;

commit;
