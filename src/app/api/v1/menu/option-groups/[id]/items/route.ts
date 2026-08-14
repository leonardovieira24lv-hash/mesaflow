import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/api/auth";
import { apiCreated } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { createOptionGroupItemSchema } from "@/lib/validations/option-groups";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/v1/menu/option-groups/{id}/items — adiciona 1 opção dentro de
// um grupo já existente (ex.: "Catupiry" dentro do grupo "Borda").
//
// Confirma que o grupo pertence a este restaurante ANTES de inserir — não
// dá pra usar `.eq("restaurant_id", ...)` direto no insert de
// `option_group_items` porque essa tabela não tem essa coluna (o
// isolamento por restaurante vem de `option_groups`, mesmo desenho de
// `order_items`/`orders`). RLS já bloqueia isso também (`0036`), esta é
// a segunda camada, com uma mensagem de erro melhor pro usuário.
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: optionGroupId } = await params;
    const { profile } = await requireOwner();
    const body = await request.json();
    const { name, priceDelta } = parseOrThrow(createOptionGroupItemSchema, body);

    const supabase = await createClient();

    const { data: group, error: groupError } = await supabase
      .from("option_groups")
      .select("id")
      .eq("id", optionGroupId)
      .eq("restaurant_id", profile.restaurantId)
      .maybeSingle();

    if (groupError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível confirmar o grupo de opção.");
    }
    if (!group) {
      throw new AppError("NOT_FOUND", "Grupo de opção não encontrado.");
    }

    // Posição da opção nova é sempre a última — mesmo cálculo já usado em
    // `menu/categories/route.ts` (maior `position` atual + 1).
    const { data: last, error: lastError } = await supabase
      .from("option_group_items")
      .select("position")
      .eq("option_group_id", optionGroupId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível calcular a posição da opção.");
    }

    const nextPosition = (last?.position ?? 0) + 1;

    const { data: created, error: insertError } = await supabase
      .from("option_group_items")
      .insert({ option_group_id: optionGroupId, name, price_delta: priceDelta, position: nextPosition })
      .select("id, name, price_delta")
      .single();

    if (insertError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível criar a opção. Tente novamente.");
    }

    return apiCreated({ id: created.id, name: created.name, priceDelta: created.price_delta });
  } catch (err) {
    return handleRouteError(err);
  }
}
