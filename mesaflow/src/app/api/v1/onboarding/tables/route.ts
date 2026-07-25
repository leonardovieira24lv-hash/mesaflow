import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/api/auth";
import { apiCreated } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { createTablesSchema } from "@/lib/validations/onboarding";

// POST /api/v1/onboarding/tables — contrato seção 2.2
//
// Segunda e última etapa de dados do onboarding: cria N mesas numeradas de
// uma vez. Só pode ser chamado uma vez por restaurante — chamadas repetidas
// (ex.: reenvio acidental do formulário) retornam 409 em vez de duplicar
// mesas, verificado por já existir alguma mesa cadastrada para o restaurante.
export async function POST(request: Request) {
  try {
    const { profile } = await requireOwner();
    const body = await request.json();
    const { quantity } = parseOrThrow(createTablesSchema, body);

    const supabase = await createClient();

    const { count, error: countError } = await supabase
      .from("tables")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", profile.restaurantId);

    if (countError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível verificar as mesas existentes.");
    }
    if (count && count > 0) {
      throw new AppError("CONFLICT", "As mesas deste restaurante já foram cadastradas.");
    }

    const padLength = Math.max(2, String(quantity).length);
    const rows = Array.from({ length: quantity }, (_, i) => ({
      restaurant_id: profile.restaurantId,
      name: `Mesa ${String(i + 1).padStart(padLength, "0")}`,
    }));

    const { data: tables, error: insertError } = await supabase
      .from("tables")
      .insert(rows)
      .select("id, name, qr_token")
      .order("name", { ascending: true });

    if (insertError || !tables) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível criar as mesas. Tente novamente.");
    }

    return apiCreated(
      tables.map((t) => ({ id: t.id, name: t.name, qr_token: t.qr_token })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
