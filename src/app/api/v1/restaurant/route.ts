import { createClient } from "@/lib/supabase/server";
import { requireSession, requireOwner } from "@/lib/api/auth";
import { getRestaurantOverview } from "@/lib/restaurant/get-restaurant-overview";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { updateRestaurantSchema } from "@/lib/validations/restaurant";

// GET /api/v1/restaurant — contrato seção 4.1
export async function GET() {
  try {
    const { profile } = await requireSession();
    const supabase = await createClient();
    const overview = await getRestaurantOverview(supabase, profile.restaurantId);

    return apiSuccess({
      id: overview.id,
      name: overview.name,
      slug: overview.slug,
      status: overview.status,
      checklist: {
        has_categories: overview.checklist.hasCategories,
        has_products: overview.checklist.hasProducts,
        qr_codes_printed: overview.checklist.qrCodesPrinted,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// PATCH /api/v1/restaurant — contrato seção 4.2 (Sprint 9)
//
// Só o `owner` pode alterar dados administrativos do restaurante (o
// contrato restringe explicitamente este endpoint, ao contrário do
// Cardápio/Mesas) — por isso `requireOwner()` em vez de `requireSession()`.
// A mesma restrição já existe em RLS (`update_own_restaurant_as_owner`,
// migration 0003), então esta é a segunda camada de segurança de sempre
// (seção 1.6): mesmo que este guard fosse removido por engano, o banco
// ainda recusaria a escrita para quem não é owner.
export async function PATCH(request: Request) {
  try {
    const { profile } = await requireOwner();
    const body = await request.json();
    const { name, slug } = parseOrThrow(updateRestaurantSchema, body);

    const supabase = await createClient();

    // PATCH parcial: só entra no `update` o que foi de fato enviado —
    // mesmo espírito de `tables/[id]/route.ts` (7.3) e
    // `menu/categories/[id]/route.ts` (5.3).
    const updates: { name?: string; slug?: string } = {};
    if (name !== undefined) updates.name = name;
    if (slug !== undefined) updates.slug = slug;

    const { data: updated, error } = await supabase
      .from("restaurants")
      .update(updates)
      .eq("id", profile.restaurantId)
      .select("id, name, slug, status")
      .maybeSingle();

    if (error) {
      // 23505 = unique_violation (restaurants.slug) — outro restaurante já
      // usa o slug informado (contrato 4.2: "checar unicidade entre todos
      // os restaurantes").
      if (error.code === "23505") {
        throw new AppError("CONFLICT", "Este slug já está em uso por outro restaurante.");
      }
      throw new AppError(
        "INTERNAL_ERROR",
        "Não foi possível atualizar o restaurante. Tente novamente.",
      );
    }

    // Rede de segurança: `profile.restaurantId` vem da própria sessão do
    // usuário (via `profiles`), então este `null` não deveria acontecer em
    // uso normal — mas cobre o caso defensivamente, mesmo padrão já usado
    // nos demais módulos.
    if (!updated) {
      throw new AppError("NOT_FOUND", "Restaurante não encontrado.");
    }

    // Mesmo formato de 4.1, sem o campo `checklist` (específico da leitura
    // para o Dashboard, conforme o próprio contrato define para este
    // endpoint).
    return apiSuccess({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      status: updated.status,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
