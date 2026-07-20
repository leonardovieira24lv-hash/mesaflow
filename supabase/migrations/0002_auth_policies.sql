-- MesaFlow — políticas de RLS do módulo de Autenticação
--
-- `requireSession()` (lib/api/auth.ts) consulta `profiles` usando o cliente
-- Supabase autenticado do usuário (anon key + JWT), não a service role — ou
-- seja, sem uma política de SELECT explícita, a consulta sempre voltaria
-- vazia e todo mundo cairia em 401, mesmo logado corretamente. Esta é a
-- única política estritamente necessária para a Sprint 3; as demais
-- políticas (mesas, cardápio, pedidos) ficam para os módulos de negócio
-- correspondentes.

create policy "select_own_profile" on public.profiles
  for select
  using (id = auth.uid());
