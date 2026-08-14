import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/api/auth";
import { apiSuccess, apiNoContent } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { updateCategorySchema } from "@/lib/validations/menu";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/v1/menu/categories/{id} — contrato seção 5.3
// Fase 3 (Gestão de Equipe, 2026-08-09): requireSession() -> requireOwner()
// — ver nota em menu/categories/route.ts.
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { profile } = await requireOwner();
    const body = await request.json();
    const { name, allowsHalfAndHalf } = parseOrThrow(updateCategorySchema, body);

    const supabase = await createClient();

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (allowsHalfAndHalf !== undefined) updates.allows_half_and_half = allowsHalfAndHalf;

    const { data: updated, error } = await supabase
      .from("menu_categories")
      .update(updates)
      .eq("id", id)
      .eq("restaurant_id", profile.restaurantId)
      .select("id, name, position, allows_half_and_half")
      .maybeSingle();

    if (error) {
      // 23505 = unique_violation (restaurant_id, name).
      if (error.code === "23505") {
        throw new AppError("CONFLICT", "Já existe uma categoria com esse nome.");
      }
      throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar a categoria. Tente novamente.");
    }

    // RLS + o filtro por restaurant_id garantem que uma categoria de outro
    // restaurante nunca aparece aqui — o resultado nulo cobre tanto "não
    // existe" quanto "não é sua" com a mesma resposta (seção 5.3).
    if (!updated) {
      throw new AppError("NOT_FOUND", "Categoria não encontrada.");
    }

    return apiSuccess({
      id: updated.id,
      name: updated.name,
      position: updated.position,
      allowsHalfAndHalf: updated.allows_half_and_half,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE /api/v1/menu/categories/{id} — contrato seção 5.4
// Fase 3 (Gestão de Equipe, 2026-08-09): requireSession() -> requireOwner().
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { profile } = await requireOwner();

    const supabase = await createClient();

    const { data: deleted, error } = await supabase
      .from("menu_categories")
      .delete()
      .eq("id", id)
      .eq("restaurant_id", profile.restaurantId)
      .select("id")
      .maybeSingle();

    if (error) {
      // 23503 = foreign_key_violation — `menu_items.category_id` é
      // `on delete restrict` (migration 0001): existem produtos vinculados.
      // Deixamos o próprio banco ser a fonte da verdade em vez de fazer uma
      // consulta de contagem separada antes (evita condição de corrida).
      if (error.code === "23503") {
        throw new AppError(
          "CONFLICT",
          "Esta categoria tem produtos vinculados. Mova ou exclua os produtos primeiro.",
        );
      }
      throw new AppError("INTERNAL_ERROR", "Não foi possível excluir a categoria. Tente novamente.");
    }

    if (!deleted) {
      throw new AppError("NOT_FOUND", "Categoria não encontrada.");
    }

    return apiNoContent();
  } catch (err) {
    return handleRouteError(err);
  }
}
