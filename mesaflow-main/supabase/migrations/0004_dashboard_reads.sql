-- MesaFlow — leituras do Dashboard (Sprint 5)
--
-- O Dashboard precisa contar categorias/produtos/pedidos do restaurante
-- para os cards de resumo e o checklist (contrato seção 4.1), mesmo antes
-- de esses módulos existirem de verdade — sem uma política de SELECT,
-- `count` sempre voltaria 0 por causa do RLS, mascarando dados reais assim
-- que os módulos de Cardápio/Pedidos forem implementados.
--
-- Apenas leitura: políticas de escrita (insert/update/delete) ficam para os
-- módulos de Cardápio (Sprint 6+) e Pedidos, quando existirem de fato.

create policy "select_own_categories" on public.menu_categories
  for select
  using (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()));

create policy "select_own_items" on public.menu_items
  for select
  using (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()));

create policy "select_own_orders" on public.orders
  for select
  using (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()));
