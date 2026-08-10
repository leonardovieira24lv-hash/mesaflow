-- MesaFlow — Fase 3, Gestão de Equipe (2026-08-10, ajuste pós-implementação).
--
-- `profiles.id references auth.users (id) on delete cascade`
-- (`0001_initial_schema.sql`) já cuida de apagar o profile junto com o
-- usuário do Auth. Mas duas tabelas criadas em Sprints posteriores também
-- referenciam `profiles(id)`, sem cascade nenhum:
--
--   - table_events.resolved_by      (0012_table_events.sql)
--   - cashier_closings.closed_by    (0023_create_cashier_closings.sql, NOT NULL)
--
-- Com o padrão default do Postgres (RESTRICT), apagar um funcionário que já
-- resolveu um chamado de mesa ou fechado o caixa alguma vez era barrado
-- pelo banco — a chamada `admin.auth.admin.deleteUser()` (Fase 3,
-- `DELETE /api/v1/team/{id}`) falhava com um erro genérico.
--
-- Decisão (confirmada explicitamente): o HISTÓRICO fica intocável — os
-- registros de `table_events`/`cashier_closings` continuam existindo, com
-- todos os valores, datas e dados de negócio intactos. Só a referência a
-- "quem" resolveu/fechou vira `null` nesses registros antigos, se a pessoa
-- for removida depois — os registros não desaparecem nem ficam
-- inconsistentes, só perdem essa atribuição específica.
--
-- `closed_by` era `not null` — precisa virar opcional para aceitar `null`
-- depois de uma remoção. Conferido antes desta migration: nenhum código da
-- aplicação lê `closed_by`/`resolved_by` assumindo que nunca é nulo (os
-- únicos usos encontrados são de ESCRITA, ao criar o registro) — nenhuma
-- tela exibe "fechado por" hoje, então não há UI para ajustar.
alter table public.cashier_closings
  alter column closed_by drop not null;

alter table public.table_events
  drop constraint table_events_resolved_by_fkey,
  add constraint table_events_resolved_by_fkey
    foreign key (resolved_by) references public.profiles (id) on delete set null;

alter table public.cashier_closings
  drop constraint cashier_closings_closed_by_fkey,
  add constraint cashier_closings_closed_by_fkey
    foreign key (closed_by) references public.profiles (id) on delete set null;
