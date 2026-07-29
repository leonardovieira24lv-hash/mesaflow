import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess, apiNoContent } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { updateMenuItemSchema } from "@/lib/validations/menu";
import type { MenuItemDto } from "@/types/menu-item-dto";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function toItemDto(row: {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_archived: boolean;
}): MenuItemDto {
  return {
    id: row.id,
    category_id: row.category_id,
    name: row.name,
    description: row.description ?? undefined,
    price: row.price,
    image_url: row.image_url ?? undefined,
    is_available: row.is_available,
    is_archived: row.is_archived,
  };
}

// GET /api/v1/menu/items/{id} — contrato seção 6.3
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { profile } = await requireSession();

    const supabase = await createClient();

    const { data: item, error } = await supabase
      .from("menu_items")
      .select("id, category_id, name, description, price, image_url, is_available, is_archived")
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
    const { id } = await params;
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
    // Sprint "Arquivamento — Visualizar e Restaurar" (2026-07-28): único uso
    // real esperado é `is_archived: false` (Restaurar). O DELETE deste mesmo
    // arquivo continua sendo quem arquiva de verdade (com a checagem de
    // histórico) — este PATCH não impõe essa regra porque já é o endpoint
    // genérico de edição parcial (mesmo padrão de `is_available`), então
    // tecnicamente aceita `true` também, mas nenhuma tela chama isso.
    if (input.is_archived !== undefined) patch.is_archived = input.is_archived;

    const { data: updated, error: updateError } = await supabase
      .from("menu_items")
      .update(patch)
      .eq("id", id)
      .eq("restaurant_id", profile.restaurantId)
      .select("id, category_id, name, description, price, image_url, is_available, is_archived")
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
//
// Sprint "Exclusão Lógica de Produtos" (2026-07-28): produto que já
// apareceu em algum pedido não pode ser apagado fisicamente (FK
// `on delete restrict` em `order_items.menu_item_id`, mantida de propósito
// — o dono quer preservar a relação pedido↔produto para estatísticas
// futuras). Em vez de só devolver 409 e travar o usuário, agora arquivamos
// (`is_archived = true`) — o produto some do cardápio público e de novos
// pedidos, mas a linha em `menu_items` continua existindo, então
// `order_items.menu_item_id` nunca fica sem destino e o histórico
// permanece 100% intacto e consultável.
//
// A checagem é feita ANTES de tentar apagar (conta `order_items` — já
// existe política de SELECT para isso, `select_own_order_items`), em vez
// de só reagir ao erro 23503 do Postgres, para não depender de exceção
// como fluxo normal do caso mais comum (produto com histórico). O catch de
// 23503 abaixo continua existindo só como rede de segurança para uma
// corrida rara (pedido criado bem entre a contagem e o delete).
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { profile } = await requireSession();

    const supabase = await createClient();

    const { count, error: countError } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("menu_item_id", id);

    if (countError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível verificar o histórico do produto.");
    }

    if (count && count > 0) {
      const { data: archived, error: archiveError } = await supabase
        .from("menu_items")
        .update({ is_archived: true })
        .eq("id", id)
        .eq("restaurant_id", profile.restaurantId)
        .select("id")
        .maybeSingle();

      if (archiveError) {
        throw new AppError("INTERNAL_ERROR", "Não foi possível arquivar o produto. Tente novamente.");
      }
      if (!archived) {
        throw new AppError("NOT_FOUND", "Produto não encontrado.");
      }

      // 200 com corpo (não 204) só neste caso: o cliente precisa distinguir
      // "arquivado" de "excluído de verdade" para mostrar o feedback certo
      // (Sprint "Arquivamento — Visualizar e Restaurar", 2026-07-28).
      return apiSuccess({ archived: true });
    }

    const { data: deleted, error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", id)
      .eq("restaurant_id", profile.restaurantId)
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "23503") {
        // Rede de segurança: um pedido usou este produto entre a contagem
        // acima e este delete (corrida rara). Arquiva em vez de falhar.
        const { error: fallbackArchiveError } = await supabase
          .from("menu_items")
          .update({ is_archived: true })
          .eq("id", id)
          .eq("restaurant_id", profile.restaurantId);

        if (fallbackArchiveError) {
          throw new AppError("INTERNAL_ERROR", "Não foi possível excluir o produto. Tente novamente.");
        }
        return apiSuccess({ archived: true });
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
