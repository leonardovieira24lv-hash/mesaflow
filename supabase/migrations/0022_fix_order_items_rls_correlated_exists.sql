-- MesaFlow — Correção de RLS: select_own_order_items com EXISTS
-- correlacionado (Sprint "Correção — RLS em order_items", 2026-07-30)
--
-- Causa raiz confirmada por experimento (comparação cliente autenticado vs
-- service role, mesma consulta, mesmo order_session_id): a policy original
--
--   using (
--     order_id in (
--       select id from public.orders
--       where restaurant_id in (select restaurant_id from public.profiles where id = auth.uid())
--     )
--   )
--
-- é uma subconsulta NÃO correlacionada — não referencia
-- `order_items.order_id` dentro do próprio `where` da subconsulta, só
-- compara o resultado final com `in`. Isso funciona normalmente numa
-- consulta direta a `order_items`, mas o `GET /api/v1/tables/{id}/close-bill`
-- lê `order_items` como recurso aninhado do PostgREST, dentro de um
-- `select` em `orders` (`orders(..., order_items(name, quantity, price))`).
-- Nesse contexto de embed, a falta de correlação explícita entre a
-- subconsulta e a linha de `order_items` sendo avaliada impede o Postgres
-- de resolver a policy corretamente — o pedido (`orders`) continuava
-- visível (policy própria, direta, sem esse problema), mas o array
-- embutido de itens sempre voltava vazio, mesmo as linhas existindo de
-- verdade (confirmado lendo com o cliente admin).
--
-- Correção: mesma regra de autorização (mesmo restaurante, mesma tabela
-- `profiles`), reescrita como `exists` com subconsulta CORRELACIONADA —
-- referenciando `order_items.order_id` explicitamente dentro do `where`
-- da subconsulta. Nenhuma outra policy foi tocada.
drop policy if exists "select_own_order_items" on public.order_items;

create policy "select_own_order_items" on public.order_items
  for select
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and o.restaurant_id in (select restaurant_id from public.profiles where id = auth.uid())
    )
  );
