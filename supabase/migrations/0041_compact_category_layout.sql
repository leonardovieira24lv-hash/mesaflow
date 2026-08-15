-- MesaFlow/Forko — Layout compacto por categoria (2026-08-15).
--
-- Ideia do dono, comparando com outros cardápios que já viu: produto tipo
-- bebida (base sempre igual, não precisa de foto grande nem descrição)
-- fica esquisito ocupando o mesmo card grande de uma pizza. Mockup
-- aprovado antes de codar (regra do projeto).
--
-- `is_compact` — mesmo raciocínio de `allows_half_and_half` (migration
-- 0039): interruptor por categoria inteira, não travado no nome
-- "bebidas" — qualquer categoria pode virar compacta (ex.: adicionais,
-- sobremesas pequenas). Default `false`, nenhuma categoria existente
-- muda de comportamento sozinha.
alter table public.menu_categories
  add column is_compact boolean not null default false;
