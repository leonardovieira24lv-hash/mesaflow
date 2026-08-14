-- MesaFlow/Forko — Sistema de Opcionais, Fase 3 (meio a meio).
--
-- Mecanismo à parte, deliberadamente fora do sistema de `option_groups`
-- (Fases 1/2): meio a meio não é "escolher uma opção dentro de um
-- produto" — é combinar DOIS produtos inteiros (dois sabores) num só
-- item de pedido. Confirmado com o dono: só faz sentido pra pizzaria,
-- ativado por CATEGORIA inteira (não produto por produto).
--
-- `menu_categories.allows_half_and_half` — o dono liga isto na categoria
-- (ex.: "Pizzas"); todo produto dessa categoria pode ser combinado com
-- qualquer outro produto da MESMA categoria. Default `false` — nenhuma
-- categoria existente muda de comportamento sozinha.
--
-- `order_items.half_and_half` — snapshot JSON do 2º sabor escolhido
-- (nome + preço no momento da compra), mesmo raciocínio já usado em
-- `selected_options` (0036): se o dono renomear ou mudar o preço da
-- pizza amanhã, pedido de ontem não muda sozinho. O 1º sabor não precisa
-- de campo novo — ele já É o `menu_item_id`/`name`/`price` normais do
-- item (regra de preço confirmada: cobra sempre o valor do sabor MAIS
-- CARO entre os dois, então o item já nasce com o preço certo desde a
-- criação — nada de recalcular em cascata depois).
alter table public.menu_categories
  add column allows_half_and_half boolean not null default false;

alter table public.order_items
  add column half_and_half jsonb;
