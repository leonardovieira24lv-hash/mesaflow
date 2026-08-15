-- MesaFlow/Forko — Foto por categoria (2026-08-15).
--
-- Ideia do dono, inspirada num anúncio de concorrente (Takeat): categorias
-- como círculos com foto, em vez da pílula de texto puro que o Cardápio
-- Público usa hoje. `image_url` opcional — se o dono não subir nenhuma
-- (ele mesmo reconheceu que nem todo dono de restaurante vai querer
-- cuidar disso), o front-end recorre a um fallback em cascata: foto da
-- categoria → foto do 1º produto cadastrado nela → iniciais do nome.
-- Nenhuma lógica de fallback mora no banco — é tudo resolvido no
-- Cardápio Público, ver `category-nav.tsx`.
alter table public.menu_categories
  add column image_url text;
