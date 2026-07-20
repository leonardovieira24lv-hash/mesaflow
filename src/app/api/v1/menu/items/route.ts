import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess, apiCreated } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { createMenuItemSchema, listMenuItemsQuerySchema } from "@/lib/validations/menu";

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

// GET /api/v1/menu/items — contrato seção 6.1
export async function GET(request: Request) {
  try {
    const { profile } = await requireSession();
    const { searchParams } = new URL(request.url);
    const query = parseOrThrow(listMenuItemsQuerySchema, {
      category_id: searchParams.get("category_id") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      per_page: searchParams.get("per_page") ?? undefined,
    });

    const supabase = await createClient();

    let queryBuilder = supabase
      .from("menu_items")
      .select("id, category_id, name, description, price, image_url, is_available", { count: "exact" })
      .eq("restaurant_id", profile.restaurantId);

    if (query.category_id) {
      queryBuilder = queryBuilder.eq("category_id", query.category_id);
    }

    const from = (query.page - 1) * query.per_page;
    const to = from + query.per_page - 1;

    const { data, error, count } = await queryBuilder
      .order("name", { ascending: true })
      .range(from, to);

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível carregar os produtos.");
    }

    const total = count ?? 0;
    return apiSuccess((data ?? []).map(toItemDto), {
      meta: {
        page: query.page,
        per_page: query.per_page,
        total,
        total_pages: Math.max(1, Math.ceil(total / query.per_page)),
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST /api/v1/menu/items — contrato seção 6.2
export async function POST(request: Request) {
  try {
    const { profile } = await requireSession();
    const body = await request.json();
    const input = parseOrThrow(createMenuItemSchema, body);

    const supabase = await createClient();

    // A categoria precisa existir e pertencer ao restaurante autenticado —
    // checagem explícita em vez de confiar só na FK, para poder devolver
    // `404 NOT_FOUND` (seção 6.2) em vez de um erro genérico de banco.
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

    const { data: created, error: insertError } = await supabase
      .from("menu_items")
      .insert({
        restaurant_id: profile.restaurantId,
        category_id: input.category_id,
        name: input.name,
        description: input.description || null,
        price: input.price,
        image_url: input.image_url || null,
        is_available: input.is_available ?? true,
      })
      .select("id, category_id, name, description, price, image_url, is_available")
      .single();

    if (insertError) {
      // 23505 = unique_violation (category_id, name) — nome duplicado na categoria.
      if (insertError.code === "23505") {
        throw new AppError("CONFLICT", "Já existe um produto com esse nome nesta categoria.");
      }
      throw new AppError("INTERNAL_ERROR", "Não foi possível criar o produto. Tente novamente.");
    }

    return apiCreated(toItemDto(created));
  } catch (err) {
    return handleRouteError(err);
  }
}
