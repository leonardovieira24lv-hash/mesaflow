-- MesaFlow — Sprint 2 de Correção (Fase de Estabilização): Módulo de Mesas
--
-- `tables` nunca foi publicada no `supabase_realtime` — só `orders` foi
-- (migration 0007). Isso significa que uma mudança de status de mesa (abrir,
-- liberar, editar) feita num dispositivo nunca chegava a outro dispositivo
-- com o painel de Mesas aberto: sem Realtime, a única forma de outro
-- operador ver a mudança era recarregar a página manualmente. A política de
-- RLS que autoriza a assinatura (`select_own_tables`, migration 0003) já
-- existe — só faltava publicar a tabela.
alter publication supabase_realtime add table public.tables;
