-- MesaFlow — Etapa 1, Tema do Cardápio Público (2026-08-11).
--
-- Mesmo raciocínio já usado em `0025`/`0026`/`0028`/`0029`: só `alter table
-- add column`, sem policy nova — `update_own_restaurant_as_owner`
-- (`0003_onboarding.sql`) já cobre a tabela inteira, coluna nova incluída
-- automaticamente.
--
-- `not null default 'dark'`: obrigatório preservar o comportamento visual
-- atual de todo restaurante já existente (Cardápio Público hoje é sempre
-- escuro) — ninguém muda de aparência sem escolher isso explicitamente.
--
-- Esta migration SÓ persiste a preferência — nenhuma tela pública lê essa
-- coluna ainda (propagação ao Cardápio é etapa futura, fora deste escopo).
alter table public.restaurants
  add column menu_theme text not null default 'dark'
    check (menu_theme in ('light', 'dark'));
