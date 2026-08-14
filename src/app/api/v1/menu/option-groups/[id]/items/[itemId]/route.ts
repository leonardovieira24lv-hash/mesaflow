import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/api/auth";
import { apiSuccess, apiNoContent } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { updateOptionGroupItemSchema } from "@/lib/validations/option-groups";

interface RouteParams {
  params: Promise<{ id: string; itemId: string }>;
}

// PATCH /api/v1/menu/option-groups/{id}/items/{itemId}
//
// Filtra por `option_group_id = id` (não só `id = itemId`) de propósito —
// evita um owner de um restaurante editar uma opção de outro grupo só
// porque acertou o UUID por acaso; o `id` da URL precisa bater com o
// grupo dono da opção, reforçando o isolamento por restaurante que já
// vem de `option_groups` (RLS + a checagem em `items/route.ts`).
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id: optionGroupId, itemId } = await params;
    await requireOwner();
    const body = await request.json();
    const { name, priceDelta } = parseOrThrow(updateOptionGroupItemSchema, body);

    const supabase = await createClient();

    const updates: { name?: string; price_delta?: number } = {};
    if (name !== undefined) updates.name = name;
    if (priceDelta !== undefined) updates.price_delta = priceDelta;

    const { data: updated, error } = await supabase
      .from("option_group_items")
      .update(updates)
      .eq("id", itemId)
      .eq("option_group_id", optionGroupId)
      .select("id, name, price_delta")
      .maybeSingle();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar a opção. Tente novamente.");
    }
    if (!updated) {
      throw new AppError("NOT_FOUND", "Opção não encontrada.");
    }

    return apiSuccess({ id: updated.id, name: updated.name, priceDelta: updated.price_delta });
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE /api/v1/menu/option-groups/{id}/items/{itemId}
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id: optionGroupId, itemId } = await params;
    await requireOwner();

    const supabase = await createClient();

    const { data: deleted, error } = await supabase
      .from("option_group_items")
      .delete()
      .eq("id", itemId)
      .eq("option_group_id", optionGroupId)
      .select("id")
      .maybeSingle();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível excluir a opção. Tente novamente.");
    }
    if (!deleted) {
      throw new AppError("NOT_FOUND", "Opção não encontrada.");
    }

    return apiNoContent();
  } catch (err) {
    return handleRouteError(err);
  }
}
