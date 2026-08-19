-- Forko — perfil do negócio para contextualizar o onboarding e o construtor de cardápio.
-- Nullable de propósito: restaurantes existentes continuam funcionando sem migração manual.

alter table public.restaurants
  add column if not exists business_type text;

alter table public.restaurants
  drop constraint if exists restaurants_business_type_check;

alter table public.restaurants
  add constraint restaurants_business_type_check
  check (
    business_type is null
    or business_type in ('burger', 'pizza', 'acai', 'snack', 'bar', 'restaurant', 'dessert', 'cafe', 'other')
  );

-- Nova assinatura para novos cadastros. A função antiga (3 argumentos) fica intacta
-- para compatibilidade com qualquer chamada existente.
create or replace function public.create_restaurant_with_owner(
  p_user_id uuid,
  p_restaurant_name text,
  p_slug text,
  p_business_type text
) returns public.restaurants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant public.restaurants;
begin
  insert into public.restaurants (name, slug, status, business_type)
  values (p_restaurant_name, p_slug, 'onboarding', p_business_type)
  returning * into v_restaurant;

  insert into public.profiles (id, restaurant_id, role)
  values (p_user_id, v_restaurant.id, 'owner');

  return v_restaurant;
end;
$$;

revoke all on function public.create_restaurant_with_owner(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.create_restaurant_with_owner(uuid, text, text, text) to service_role;
