-- MesaFlow/Forko — Sistema de Opcionais, Fase 2 (múltipla escolha com
-- limite). Cobre: "Adicionais (escolha até 3)", coberturas de açaí,
-- qualquer grupo onde o cliente pode marcar mais de uma opção, com teto.
--
-- Fase 1 (migration 0036) só sabia fazer "escolha única obrigatória" — não
-- existia coluna nenhuma pra tipo de seleção, limite ou obrigatoriedade.
-- Esta migration adiciona 3 colunas em `option_groups`, todas com default
-- que reproduz o comportamento da Fase 1 — nenhum grupo já cadastrado
-- muda de comportamento sozinho:
--
-- `selection_type` — 'single' (Fase 1, default) ou 'multiple' (Fase 2).
-- `max_selections` — só relevante quando 'multiple'; quantas opções o
--   cliente pode marcar no máximo. `null` para grupos 'single' (não faz
--   sentido lá, exatamente 1 já é a regra).
-- `required` — true (Fase 1, default) = cliente é obrigado a escolher
--   pelo menos 1; false = grupo opcional (cliente pode não marcar nada).
--
-- `option_groups_selection_shape` garante no próprio banco que
-- 'single'+max_selections nulo e 'multiple'+max_selections>0 são as
-- únicas combinações possíveis — mesmo raciocínio de "constraint no
-- banco, não só na aplicação" já usado em `option_groups_exactly_one_target`
-- (migration 0036).
alter table public.option_groups
  add column selection_type text not null default 'single'
    check (selection_type in ('single', 'multiple')),
  add column max_selections integer,
  add column required boolean not null default true;

alter table public.option_groups
  add constraint option_groups_selection_shape check (
    (selection_type = 'single' and max_selections is null)
    or (selection_type = 'multiple' and max_selections is not null and max_selections > 0)
  );
