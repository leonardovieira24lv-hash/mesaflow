import { createClient } from "@/lib/supabase/server";
import { requireSession, requireOwner } from "@/lib/api/auth";
import { apiSuccess, apiCreated } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { createCategorySchema } from "@/lib/validations/menu";

// GET /api/v1/menu/categories — contrato seção 5.1
export async function GET() {
  try {
    const { profile } = await requireSession();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("menu_categories")
      .select("id, name, position")
      .eq("restaurant_id", profile.restaurantId)
      .order("position", { ascending: true });

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível carregar as categorias.");
    }

    return apiSuccess(data.map((c) => ({ id: c.id, name: c.name, position: c.position })));
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST /api/v1/menu/categories — contrato seção 5.2
//
// Fase 3 (Gestão de Equipe, 2026-08-09): `requireSession()` → `requireOwner()`.
// A auditoria da Fase 3 encontrou que toda a escrita do Cardápio estava
// aberta a qualquer profile autenticado do restaurante, sem diferenciar
// owner/staff — decisão correta quando só existia um papel (Sprint 6), mas
// incompatível com o modelo agora aprovado ("staff não pode criar/editar/
// excluir categorias ou produtos"). Leitura (`GET`, acima) continua aberta —
// staff precisa ver o cardápio pra operar, só não editá-lo.
export async function POST(request: Request) {
  try {
    const { profile } = await requireOwner();
    const body = await request.json();
    const { name } = parseOrThrow(createCategorySchema, body);

    const supabase = await createClient();

    // A posição da nova categoria é sempre a última — busca o maior
    // `position` atual do restaurante para calcular a próxima (seção 5.2:
    // "position calculada automaticamente como a última").
    const { data: last, error: lastError } = await supabase
      .from("menu_categories")
      .select("position")
      .eq("restaurant_id", profile.restaurantId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível calcular a posição da categoria.");
    }

    const nextPosition = (last?.position ?? 0) + 1;

    const { data: created, error: insertError } = await supabase
      .from("menu_categories")
      .insert({ restaurant_id: profile.restaurantId, name, position: nextPosition })
      .select("id, name, position")
      .single();

    if (insertError) {
      // 23505 = unique_violation (restaurant_id, name) — nome já usado
      // neste restaurante (seção 5.2).
      if (insertError.code === "23505") {
        throw new AppError("CONFLICT", "Já existe uma categoria com esse nome.");
      }
      throw new AppError("INTERNAL_ERROR", "Não foi possível criar a categoria. Tente novamente.");
    }

    return apiCreated({ id: created.id, name: created.name, position: created.position });
  } catch (err) {
    return handleRouteError(err);
  }
}
