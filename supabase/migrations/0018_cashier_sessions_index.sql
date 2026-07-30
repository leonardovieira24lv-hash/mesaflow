-- MesaFlow — Painel de Caixa (Sprint "Painel de Caixa", 2026-07-30)
--
-- O histórico de vendas já existe: uma `order_session` fechada
-- (`closed_at` preenchido, `payment_method` preenchido — migration 0017)
-- já É o registro permanente de uma comanda finalizada. `orders`/`order_items`
-- vinculados a ela nunca são apagados. Nenhuma tabela nova, nenhuma coluna
-- nova, nenhuma duplicação de dado — só reaproveitamento.
--
-- Esta migration adiciona só um índice: a tela de Caixa filtra
-- `order_sessions` por `restaurant_id` + intervalo de `closed_at` (Hoje /
-- Ontem / Últimos 7 dias / Últimos 30 dias / período personalizado) — sem
-- esse índice composto, cada consulta faria uma varredura completa da
-- tabela por restaurante. Mesmo padrão de `0010_foreign_key_indexes.sql`
-- (só índice, sem mudança de schema/dado).
create index if not exists order_sessions_restaurant_id_closed_at_idx
  on public.order_sessions (restaurant_id, closed_at desc);
