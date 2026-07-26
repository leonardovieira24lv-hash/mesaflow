-- MesaFlow — Sprint Pós-Auditoria (RC1.1): índices de chave estrangeira
--
-- A Auditoria Técnica Final apontou que nenhuma migration até agora criava
-- um índice dedicado nas colunas de FK — Postgres NÃO indexa automaticamente
-- uma foreign key (só a coluna referenciada, do lado do PK). Toda política
-- de RLS do sistema, e praticamente toda query administrativa, filtra por
-- `restaurant_id` — sem índice, isso é um sequential scan em `orders` (a
-- tabela de maior volume/maior taxa de escrita do sistema) em toda leitura.
--
-- Cada índice abaixo existe por um motivo concreto — nenhum foi criado "por
-- via das dúvidas". As colunas já cobertas por uma constraint `unique`
-- existente foram deliberadamente DEIXADAS DE FORA para não duplicar:
--
--   - menu_categories(restaurant_id, name) — unique já criada na 0001, cobre
--     buscas só por restaurant_id como prefixo à esquerda. Nada a fazer.
--   - tables(restaurant_id, name) — mesma razão. Nada a fazer.
--   - menu_items tem `unique(category_id, name)`, NÃO `(restaurant_id, ...)`
--     — restaurant_id não é o prefixo de nenhum índice existente ali, por
--     isso entra na lista abaixo.

-- menu_items: toda leitura do Cardápio (admin e público) filtra por
-- restaurant_id, e nenhuma constraint existente cobre essa coluna sozinha
-- (a unique é por category_id, não por restaurant_id).
create index if not exists menu_items_restaurant_id_idx
  on public.menu_items (restaurant_id);

-- order_sessions: sem nenhuma constraint unique que cubra restaurant_id
-- (só o índice único parcial de sessão aberta por mesa, que é sobre
-- table_id). Toda política de RLS desta tabela avalia restaurant_id por
-- linha.
create index if not exists order_sessions_restaurant_id_idx
  on public.order_sessions (restaurant_id);

-- orders: a consulta mais frequente do sistema inteiro é
-- "pedidos deste restaurante, mais recentes primeiro" (painel de Pedidos,
-- Dashboard, agregação de Mesas) — `.eq("restaurant_id", x).order("created_at",
-- {ascending:false})`. Um índice composto (restaurant_id, created_at desc)
-- serve as duas coisas de uma vez: filtra por restaurant_id (como prefixo
-- à esquerda, então também serve consultas que só filtram por
-- restaurant_id) E evita um passo de ordenação separado — mais eficaz do
-- que dois índices de uma coluna só.
create index if not exists orders_restaurant_id_created_at_idx
  on public.orders (restaurant_id, created_at desc);

-- orders.table_id: usado diretamente por `getActiveOrderForTable`
-- (lib/orders/active-order.ts) toda vez que a página resolvedora do QR Code
-- carrega, para saber se a mesa já tem um pedido em andamento.
create index if not exists orders_table_id_idx
  on public.orders (table_id);

-- orders.order_session_id: usado diretamente em
-- `orders/[id]/status/route.ts` toda vez que um pedido muda para um status
-- terminal, para checar se todos os pedidos da mesma sessão já terminaram
-- (e então fechar a order_session automaticamente).
create index if not exists orders_order_session_id_idx
  on public.orders (order_session_id);

-- order_items.order_id: toda leitura de detalhe de pedido (admin e a
-- própria criação do pedido) busca os itens por order_id; é também a coluna
-- que a política de RLS `select_own_order_items` usa para o join até
-- `orders`.
create index if not exists order_items_order_id_idx
  on public.order_items (order_id);

-- order_items.menu_item_id: sem índice aqui, TODA tentativa de excluir um
-- produto (`DELETE FROM menu_items ...`) obriga o Postgres a varrer
-- order_items inteira para checar a constraint `on delete restrict` — um
-- sequential scan disparado por uma ação comum do dia a dia do Cardápio.
create index if not exists order_items_menu_item_id_idx
  on public.order_items (menu_item_id);
