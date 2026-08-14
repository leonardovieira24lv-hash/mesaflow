import { createClient } from "@/lib/supabase/server";
import { requireSession, requireOwner } from "@/lib/api/auth";
import { apiSuccess, apiCreated } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { createOptionGroupSchema } from "@/lib/validations/option-groups";

// GET /api/v1/menu/option-groups — Sistema de Opcionais, Fase 1
// (2026-08-14). Lê `requireSession()` (staff também precisa ver isto pra
// tirar pedido manual pela mesa) — mesma distinção leitura/escrita já
// usada em categorias/produtos desde a Fase 3.
//
// Devolve todos os grupos do restaurante, cada um já com suas opções
// aninhadas (`items`) — a tela de configuração mostra tudo de uma vez,
// não precisa de uma segunda chamada por grupo.
export async function GET() {
  try {
    const { profile } = await requireSession();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("option_groups")
      .select("id, name, category_id, menu_item_id, option_group_items(id, name, price_delta, position)")
      .eq("restaurant_id", profile.restaurantId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível carregar os grupos de opção.");
    }

    return apiSuccess(
      (data ?? []).map((group) => ({
        id: group.id,
        name: group.name,
        categoryId: group.category_id,
        menuItemId: group.menu_item_id,
        items: (group.option_group_items ?? [])
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((item) => ({ id: item.id, name: item.name, priceDelta: item.price_delta })),
      })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST /api/v1/menu/option-groups — só owner (mesmo padrão de escrita do
// Cardápio inteiro desde a Fase 3/Sprint 13.2 — RLS também já exige
// `role = 'owner'` desde a criação da tabela, esta é a segunda camada,
// não a única).
export async function POST(request: Request) {
  try {
    const { profile } = await requireOwner();
    const body = await request.json();
    const { name, categoryId, menuItemId } = parseOrThrow(createOptionGroupSchema, body);

    const supabase = await createClient();

    const { data: created, error } = await supabase
      .from("option_groups")
      .insert({
        restaurant_id: profile.restaurantId,
        name,
        category_id: categoryId ?? null,
        menu_item_id: menuItemId ?? null,
      })
      .select("id, name, category_id, menu_item_id")
      .single();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível criar o grupo de opção. Tente novamente.");
    }

    return apiCreated({
      id: created.id,
      name: created.name,
      categoryId: created.category_id,
      menuItemId: created.menu_item_id,
      items: [],
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
