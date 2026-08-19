-- Forko — Tipos de grupo de opção (2026-08-19)
--
-- Mantém o motor de opcionais existente, mas permite distinguir grupos que
-- representam VARIAÇÕES DE PREÇO do produto (ex.: tamanhos de açaí).
-- O valor continua armazenado como `price_delta` para não quebrar pedidos,
-- carrinho ou o contrato atual; a UI especializada trabalha com preço final.
alter table public.option_groups
  add column group_type text not null default 'standard'
    check (group_type in ('standard', 'size'));
