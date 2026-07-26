-- MesaFlow — Sprint 1 de Correção (Fase de Estabilização): Fluxo Público do Cliente
--
-- Duas correções de banco encontradas na auditoria técnica, ambas no
-- caminho de escrita de `lib/orders/create-order.ts`:
--
--   1) Condição de corrida em `order_sessions`: o código fazia um SELECT
--      (existe sessão aberta para esta mesa?) seguido de um INSERT sem
--      nenhum lock/transação entre os dois. Duas requisições de criação de
--      pedido quase simultâneas para a mesma mesa (duplo toque no botão de
--      confirmar, ou dois clientes na mesma mesa finalizando ao mesmo
--      tempo) podiam ambas ler "nenhuma sessão aberta" e cada uma inserir a
--      sua própria — fragmentando pedidos que deveriam estar na mesma
--      comanda. O índice único abaixo torna a segunda inserção concorrente
--      um erro `23505`, que o código agora trata reconsultando a sessão
--      (ver `create-order.ts`) em vez de deixar o Postgres ser a única
--      defesa.
--
--   2) Sem idempotência na criação de pedido: um timeout de rede depois do
--      pedido já ter sido criado no servidor fazia o cliente reenviar a
--      mesma submissão, criando um pedido duplicado — sem nenhuma chave para
--      o servidor reconhecer "isto já foi processado". `idempotency_key` é
--      opcional (pedidos antigos ou clientes que não enviarem a chave
--      continuam funcionando exatamente como antes) e único por
--      restaurante: o Route Handler agora consulta por
--      (restaurant_id, idempotency_key) antes de criar, devolvendo o pedido
--      já existente em vez de duplicar.

alter table public.orders
  add column if not exists idempotency_key text;

create unique index if not exists orders_restaurant_idempotency_key_idx
  on public.orders (restaurant_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists order_sessions_one_open_per_table_idx
  on public.order_sessions (table_id)
  where closed_at is null;
