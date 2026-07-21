import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess, apiNoContent } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { updateMenuItemSchema } from "@/lib/validations/menu";

interface RouteParams {
  params: { id: string };
}

function toItemDto(row: {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
}) {
  return {
    id: row.id,
    category_id: row.category_id,
    name: row.name,
    description: row.description ?? undefined,
    price: row.price,
    image_url: row.image_url ?? undefined,
    is_available: row.is_available,
  };
}

// GET /api/v1/menu/items/{id} — contrato seção 6.3
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = params;
    const { profile } = await requireSession();

    const supabase = await createClient();

    const { data: item, error } = await supabase
      .from("menu_items")
      .select("id, category_id, name, description, price, image_url, is_available")
      .eq("id", id)
      .eq("restaurant_id", profile.restaurantId)
      .maybeSingle();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível carregar o produto.");
    }
    if (!item) {
      throw new AppError("NOT_FOUND", "Produto não encontrado.");
    }

    return apiSuccess(toItemDto(item));
  } catch (err) {
    return handleRouteError(err);
  }
}

// PATCH /api/v1/menu/items/{id} — contrato seção 6.4 (edição completa e toggle de disponibilidade)
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = params;
    const { profile } = await requireSession();
    const body = await request.json();
    const input = parseOrThrow(updateMenuItemSchema, body);

    const supabase = await createClient();

    if (input.category_id) {
      const { data: category, error: categoryError } = await supabase
        .from("menu_categories")
        .select("id")
        .eq("id", input.category_id)
        .eq("restaurant_id", profile.restaurantId)
        .maybeSingle();

      if (categoryError) {
        throw new AppError("INTERNAL_ERROR", "Não foi possível verificar a categoria informada.");
      }
      if (!category) {
        throw new AppError("NOT_FOUND", "Categoria não encontrada.");
      }
    }

    const patch: Record<string, unknown> = {};
    if (input.category_id !== undefined) patch.category_id = input.category_id;
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description || null;
    if (input.price !== undefined) patch.price = input.price;
    if (input.image_url !== undefined) patch.image_url = input.image_url || null;
    if (input.is_available !== undefined) patch.is_available = input.is_available;

    const { data: updated, error: updateError } = await supabase
      .from("menu_items")
      .update(patch)
      .eq("id", id)
      .eq("restaurant_id", profile.restaurantId)
      .select("id, category_id, name, description, price, image_url, is_available")
      .maybeSingle();

    if (updateError) {
      // 23505 = unique_violation (category_id, name).
      if (updateError.code === "23505") {
        throw new AppError("CONFLICT", "Já existe um produto com esse nome nesta categoria.");
      }
      throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar o produto. Tente novamente.");
    }

    if (!updated) {
      throw new AppError("NOT_FOUND", "Produto não encontrado.");
    }

    return apiSuccess(toItemDto(updated));
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE /api/v1/menu/items/{id} — contrato seção 6.5
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = params;
    const { profile } = await requireSession();

    const supabase = await createClient();

    const { data: deleted, error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", id)
      .eq("restaurant_id", profile.restaurantId)
      .select("id")
      .maybeSingle();

    if (error) {
      // 23503 = foreign_key_violation — `order_items.menu_item_id` é
      // `on delete restrict` (migration 0001): produto já apareceu em
      // algum pedido histórico. O banco é a fonte da verdade aqui, em vez
      // de uma consulta de contagem separada em `order_items` (que também
      // exigiria uma política de SELECT extra só para essa checagem).
      if (error.code === "23503") {
        throw new AppError(
          "CONFLICT",
          "Este produto já foi usado em pedidos e não pode ser excluído. Desative-o em vez de excluir.",
        );
      }
      throw new AppError("INTERNAL_ERROR", "Não foi possível excluir o produto. Tente novamente.");
    }

    if (!deleted) {
      throw new AppError("NOT_FOUND", "Produto não encontrado.");
    }

    return apiNoContent();
  } catch (err) {
    return handleRouteError(err);
  }
}
