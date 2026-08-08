-- MesaFlow — Gestão do Restaurante: dados cadastrais (Sprint "Gestão do
-- Restaurante", 2026-08-07).
--
-- Só `alter table add column` — sem policy nova. `update_own_restaurant_as_owner`
-- (migration 0003_onboarding.sql) já cobre a tabela inteira; RLS não é por
-- coluna, então as colunas novas já nascem protegidas pela mesma policy.
--
-- Todas as colunas são `text`, todas `nullable`: dado cadastral opcional,
-- preenchido aos poucos pelo proprietário — nenhuma delas participa de
-- nenhuma regra de negócio existente (onboarding, checklist, RLS), então
-- não há motivo para `not null`/`check` aqui.
--
-- ATENÇÃO: confirme o próximo número de sequência correto antes de
-- aplicar — a numeração exata desta migration (nome do arquivo) depende
-- do que já está de fato em `supabase/migrations/` no seu repositório;
-- não tenho visibilidade completa da pasta para garantir que "seguinte"
-- é o número certo.
alter table public.restaurants
  add column trade_name text,
  add column phone text,
  add column whatsapp text,
  add column email text,
  add column postal_code text,
  add column street text,
  add column street_number text,
  add column neighborhood text,
  add column city text,
  add column state text,
  add column instagram text,
  add column facebook text,
  add column website text;
