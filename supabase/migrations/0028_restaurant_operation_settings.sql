-- MesaFlow — Fase 4A, Configuração da Operação (2026-08-10).
--
-- Mesmo raciocínio já usado em `0025_restaurant_registration_fields.sql` e
-- `0026_restaurant_logo_and_description.sql`: só `alter table add column`,
-- sem policy nova — `update_own_restaurant_as_owner`
-- (`0003_onboarding.sql`) já cobre a tabela inteira, coluna nova incluída
-- automaticamente.
--
-- `opening_hours`: sem default/not null de propósito — ausência de
-- configuração (`null`) é um estado válido e distinto de "todo dia
-- fechado" (objeto com os 7 dias como array vazio). Esta Sprint só
-- persiste o dado; nenhum cálculo de aberto/fechado é feito ainda
-- (Fase 4B), então não há necessidade de forçar um valor default aqui.
--
-- `accepted_payment_methods`: `not null default` com as 4 formas atuais —
-- garante que nenhum restaurante já existente perca alguma opção sem
-- querer com esta migration. Os 4 valores são exatamente os mesmos já
-- usados em `order_sessions.payment_method`
-- (`0017_order_sessions_payment_method.sql`) — essa coluna e seu `check
-- constraint` NÃO são alterados por esta migration; o histórico de
-- pedidos continua completamente independente desta configuração.
alter table public.restaurants
  add column opening_hours jsonb,
  add column accepted_payment_methods text[] not null default array['pix', 'credit_card', 'debit_card', 'cash'];
