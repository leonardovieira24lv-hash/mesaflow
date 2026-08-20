-- Forko — Exclusão de categoria com produtos vinculados.
--
-- A categoria representa a estrutura atual do cardápio. Ao removê-la, os
-- produtos que pertencem a ela não devem bloquear a operação.
--
-- Integridade histórica continua valendo: `order_items.menu_item_id` é
-- RESTRICT de propósito. Portanto:
--   * produto sem histórico -> excluído fisicamente;
--   * produto já usado em pedido -> arquivado e desvinculado da categoria.
--
-- O segundo caso mantém o pedido antigo intacto, enquanto o produto deixa
-- de aparecer no cardápio atual.

drop trigger if exists prevent_category_delete_with_active_items
  on public.menu_categories;

drop function if exists public.prevent_category_delete_with_active_items();

create or replace function public.handle_category_delete_menu_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Produtos sem histórico podem ser apagados de verdade.
  delete from public.menu_items mi
  where mi.category_id = old.id
    and mi.restaurant_id = old.restaurant_id
    and not exists (
      select 1
      from public.order_items oi
      where oi.menu_item_id = mi.id
    );

  -- Produtos já usados em pedidos precisam sobreviver por causa da FK
  -- order_items.menu_item_id -> menu_items.id. Eles saem do cardápio atual.
  update public.menu_items mi
     set category_id = null,
         is_archived = true,
         is_available = false
   where mi.category_id = old.id
     and mi.restaurant_id = old.restaurant_id
     and exists (
       select 1
       from public.order_items oi
       where oi.menu_item_id = mi.id
     );

  return old;
end;
$$;

drop trigger if exists handle_category_delete_menu_items
  on public.menu_categories;

create trigger handle_category_delete_menu_items
before delete on public.menu_categories
for each row
execute function public.handle_category_delete_menu_items();
