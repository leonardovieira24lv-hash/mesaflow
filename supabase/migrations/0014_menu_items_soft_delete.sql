-- MesaFlow — Exclusão Lógica de Produtos (Sprint "Exclusão Lógica de
-- Produtos", 2026-07-28)
--
-- Contexto (investigação da sprint anterior): `order_items.menu_item_id`
-- tem `on delete restrict` (migration 0001) — qualquer produto já usado em
-- algum pedido, de qualquer status, fica permanentemente impossível de
-- excluir fisicamente. O dono decidiu explicitamente NÃO trocar essa FK
-- para `set null`: quer preservar a relação viva entre pedido e produto
-- para estatísticas futuras. Esta migration não toca em `order_items` nem
-- na FK — só adiciona a coluna que permite "excluir" um produto sem
-- apagá-lo de verdade quando ele tem histórico.
alter table public.menu_items
  add column is_archived boolean not null default false;
