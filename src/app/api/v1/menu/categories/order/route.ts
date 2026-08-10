import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { reorderCategoriesSchema } from "@/lib/validations/menu";

// PATCH /api/v1/menu/categories/order — contrato seção 5.5 (reordenação)
// Fase 3 (Gestão de Equipe, 2026-08-09): requireSession() -> requireOwner()
// — é escrita (muda `position`), mesma regra do resto do CRUD de categorias.
export async function PATCH(request: Request) {
  try {
    const { profile } = await requireOwner();
    const body = await request.json();
    const { ordered_ids: orderedIds } = parseOrThrow(reorderCategoriesSchema, body);

    const supabase = await createClient();

    const { data: existing, error: existingError } = await supabase
      .from("menu_categories")
      .select("id")
      .eq("restaurant_id", profile.restaurantId);

    if (existingError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível verificar as categorias existentes.");
    }

    // Precisa ser exatamente o conjunto completo — evita reordenação
    // parcial inconsistente (seção 5.5: "representar o conjunto completo de
    // categorias existentes").
    const existingIds = new Set(existing.map((c) => c.id));
    const sentIds = new Set(orderedIds);
    const sameSize = existingIds.size === sentIds.size;
    const sameMembers = sameSize && orderedIds.every((id) => existingIds.has(id));

    if (!sameSize || !sameMembers) {
      throw new AppError(
        "VALIDATION_ERROR",
        "A lista deve conter exatamente todas as categorias do restaurante, sem repetições.",
        [{ field: "ordered_ids", issue: "Lista incompleta ou com categoria de outro restaurante." }],
      );
    }

    // Sem upsert em lote nativo para atualização de posição por id no
    // client-js — atualiza uma a uma; a lista de categorias de um
    // restaurante é pequena (dezenas, no máximo), então o custo é
    // desprezível.
    //
    // Sprint 3 de Correção (Fase de Estabilização) — bug da auditoria: os
    // resultados de cada UPDATE não eram checados. `Promise.all` só rejeita
    // com uma exceção de JS de verdade — o supabase-js nunca lança, ele
    // devolve `{ data, error }`, então um erro em qualquer uma das N
    // atualizações passava despercebido e a resposta ainda dizia sucesso,
    // com a mesa... com as categorias numa ordem parcialmente aplicada.
    const results = await Promise.all(
      orderedIds.map((id, index) =>
        supabase
          .from("menu_categories")
          .update({ position: index + 1 })
          .eq("id", id)
          .eq("restaurant_id", profile.restaurantId),
      ),
    );

    if (results.some((result) => result.error)) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Não foi possível salvar a nova ordem por completo. Recarregue a página e tente novamente.",
      );
    }

    const { data: reordered, error: reorderedError } = await supabase
      .from("menu_categories")
      .select("id, name, position")
      .eq("restaurant_id", profile.restaurantId)
      .order("position", { ascending: true });

    if (reorderedError || !reordered) {
      throw new AppError("INTERNAL_ERROR", "Categorias reordenadas, mas não foi possível confirmar a nova ordem.");
    }

    return apiSuccess(reordered.map((c) => ({ id: c.id, name: c.name, position: c.position })));
  } catch (err) {
    return handleRouteError(err);
  }
}
