import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/api/auth";
import { apiSuccess, apiNoContent } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { updateOptionGroupSchema } from "@/lib/validations/option-groups";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/v1/menu/option-groups/{id} — só o nome é editável aqui; a
// categoria/produto vinculado não muda depois de criado nesta Fase 1 (se
// o dono errou o alvo, a ação é excluir e criar de novo — trocar o alvo
// de um grupo já em uso teria que decidir o que fazer com os pedidos
// antigos que referenciam as opções dele, fora do escopo desta fase).
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { profile } = await requireOwner();
    const body = await request.json();
    const { name } = parseOrThrow(updateOptionGroupSchema, body);

    const supabase = await createClient();

    const { data: updated, error } = await supabase
      .from("option_groups")
      .update(name !== undefined ? { name } : {})
      .eq("id", id)
      .eq("restaurant_id", profile.restaurantId)
      .select("id, name, category_id, menu_item_id")
      .maybeSingle();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar o grupo de opção. Tente novamente.");
    }

    if (!updated) {
      throw new AppError("NOT_FOUND", "Grupo de opção não encontrado.");
    }

    return apiSuccess({
      id: updated.id,
      name: updated.name,
      categoryId: updated.category_id,
      menuItemId: updated.menu_item_id,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE /api/v1/menu/option-groups/{id} — `on delete cascade` na
// migration já remove as opções dentro do grupo (`option_group_items`)
// junto, não precisa de uma segunda operação aqui.
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { profile } = await requireOwner();

    const supabase = await createClient();

    const { data: deleted, error } = await supabase
      .from("option_groups")
      .delete()
      .eq("id", id)
      .eq("restaurant_id", profile.restaurantId)
      .select("id")
      .maybeSingle();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível excluir o grupo de opção. Tente novamente.");
    }

    if (!deleted) {
      throw new AppError("NOT_FOUND", "Grupo de opção não encontrado.");
    }

    return apiNoContent();
  } catch (err) {
    return handleRouteError(err);
  }
}
