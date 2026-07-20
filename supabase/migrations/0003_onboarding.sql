-- MesaFlow — Onboarding (Sprint 4)
--
-- 1) Função transacional que cria o restaurante + o profile do owner em uma
--    única transação Postgres. O `auth.users` já foi criado antes disso via
--    Supabase Auth Admin API (não pode entrar nesta mesma transação, é uma
--    chamada de API separada) — por isso o Route Handler que chama esta
--    função é responsável por desfazer a criação do usuário caso ela falhe
--    (ver src/app/api/v1/onboarding/restaurant/route.ts).
--
-- 2) Políticas de RLS necessárias para as duas escritas autenticadas desta
--    sprint: criar mesas em lote (2.2) e confirmar impressão de QR Codes (7.5).

create or replace function public.create_restaurant_with_owner(
  p_user_id uuid,
  p_restaurant_name text,
  p_slug text
) returns public.restaurants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant public.restaurants;
begin
  insert into public.restaurants (name, slug, status)
  values (p_restaurant_name, p_slug, 'onboarding')
  returning * into v_restaurant;

  insert into public.profiles (id, restaurant_id, role)
  values (p_user_id, v_restaurant.id, 'owner');

  return v_restaurant;
end;
$$;

-- Só o service role deve poder executar isto (chamado a partir do endpoint
-- público de onboarding, autenticado pela service role key, nunca pelo
-- cliente autenticado direto).
revoke all on function public.create_restaurant_with_owner from public, anon, authenticated;
grant execute on function public.create_restaurant_with_owner to service_role;

-- ── restaurants ──────────────────────────────────────────────────────────
create policy "select_own_restaurant" on public.restaurants
  for select
  using (id in (select restaurant_id from public.profiles where id = auth.uid()));

-- Usado pelo endpoint 7.5 (print-confirmation) para gravar
-- qr_codes_printed_at/status a partir da sessão do usuário autenticado.
create policy "update_own_restaurant_as_owner" on public.restaurants
  for update
  using (
    id in (select restaurant_id from public.profiles where id = auth.uid() and role = 'owner')
  )
  with check (
    id in (select restaurant_id from public.profiles where id = auth.uid() and role = 'owner')
  );

-- ── tables ───────────────────────────────────────────────────────────────
create policy "select_own_tables" on public.tables
  for select
  using (restaurant_id in (select restaurant_id from public.profiles where id = auth.uid()));

-- Usado pelo endpoint 2.2 (criação de mesas em lote no onboarding).
create policy "insert_own_tables_as_owner" on public.tables
  for insert
  with check (
    restaurant_id in (select restaurant_id from public.profiles where id = auth.uid() and role = 'owner')
  );
