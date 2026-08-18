-- MesaFlow/Forko — Exclusão de categoria com produtos arquivados.
--
-- A categoria só deve bloquear exclusão enquanto possuir produtos ativos.
-- Produtos arquivados podem permanecer no banco para preservar histórico,
-- mas deixam de pertencer à categoria quando ela é excluída.
-- `order_items` não é alterada.

alter table public.menu_items
  alter column category_id drop not null;

alter table public.menu_items
  drop constraint if exists menu_items_category_id_fkey;

alter table public.menu_items
  add constraint menu_items_category_id_fkey
  foreign key (category_id)
  references public.menu_categories(id)
  on delete set null;

create or replace function public.prevent_category_delete_with_active_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.menu_items
    where category_id = old.id
      and restaurant_id = old.restaurant_id
      and is_archived = false
  ) then
    raise exception using
      errcode = '23514',
      message = 'category_has_active_menu_items';
  end if;

  return old;
end;
$$;

drop trigger if exists prevent_category_delete_with_active_items
  on public.menu_categories;

create trigger prevent_category_delete_with_active_items
before delete on public.menu_categories
for each row
execute function public.prevent_category_delete_with_active_items();
