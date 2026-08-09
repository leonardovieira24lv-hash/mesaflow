-- MesaFlow — Perfil do Restaurante, Fase 1 (2026-08-09).
--
-- Só `alter table add column` — sem policy nova. `update_own_restaurant_as_owner`
-- (migration 0003_onboarding.sql) já cobre a tabela inteira; RLS não é por
-- coluna, então as colunas novas já nascem protegidas pela mesma policy.
-- Mesmo raciocínio já usado em 0025_restaurant_registration_fields.sql.
--
-- `logo_url`: guarda a URL pública do Supabase Storage (bucket
-- `restaurant-media`, já existente — `0013_product_images_storage.sql`),
-- mesmo padrão de `menu_items.image_url`. Nenhum bucket ou policy de
-- Storage novo é necessário: as policies existentes já autorizam qualquer
-- caminho começando em `{restaurant_id}/...`, não só `{restaurant_id}/products/...`.
--
-- `description`: texto livre, sem limite de tamanho no banco (o limite de
-- 1000 caracteres é aplicado na validação da aplicação,
-- `lib/validations/restaurant.ts` — mudar esse limite no futuro não exige
-- migration nova).
--
-- Ambas `nullable`, dado cadastral opcional preenchido aos poucos pelo
-- proprietário, sem nenhuma regra de negócio dependente delas hoje.
alter table public.restaurants
  add column logo_url text,
  add column description text;
