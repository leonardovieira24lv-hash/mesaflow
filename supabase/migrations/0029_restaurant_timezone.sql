-- MesaFlow — Fase 4B.2, Timezone do Restaurante (2026-08-10).
--
-- Mesmo raciocínio já usado em `0025`/`0026`/`0028`: só `alter table add
-- column`, sem policy nova — `update_own_restaurant_as_owner`
-- (`0003_onboarding.sql`) já cobre a tabela inteira, coluna nova incluída
-- automaticamente.
--
-- `not null default 'America/Sao_Paulo'`: todo restaurante — existente ou
-- novo — precisa de um valor válido pra o cálculo de aberto/fechado
-- funcionar (`getRestaurantOpenStatus`, `lib/orders/resolve-public-context.ts`)
-- funcionar desde o primeiro instante. O padrão cobre a maioria dos
-- restaurantes atuais sem exigir configuração manual; o dono pode trocar a
-- qualquer momento em Configurações → Operação. Deliberadamente **não**
-- fixado em nenhuma lógica de aplicação — só aqui, como valor inicial de
-- coluna — para o sistema nunca assumir "todo restaurante é São Paulo".
alter table public.restaurants
  add column timezone text not null default 'America/Sao_Paulo';
