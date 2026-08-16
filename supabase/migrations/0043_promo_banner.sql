-- MesaFlow/Forko — Banner promocional (2026-08-16).
--
-- Última peça do estudo de caso de concorrentes (ideia registrada
-- 2026-08-14, junto com foto de categoria e barra de ações — a última
-- foi descartada pelo dono, "não tem necessidade"). Mesmo padrão de
-- `0026_restaurant_logo_and_description.sql`: campos opcionais no
-- restaurante, `enabled` default `false` — nenhum restaurante existente
-- muda de comportamento sozinho.
--
-- `promo_banner_enabled`: interruptor — o Cardápio Público só mostra o
-- banner se isto for `true` E `promo_banner_image_url` não for nulo.
-- Desligado, a tela volta a ficar idêntica a hoje, sem nenhum espaço
-- reservado (confirmado com o dono antes de codar).
alter table public.restaurants
  add column promo_banner_image_url text,
  add column promo_banner_text text,
  add column promo_banner_enabled boolean not null default false;
