import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/api/auth";
import { getRestaurantOverview } from "@/lib/restaurant/get-restaurant-overview";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { updateRestaurantSchema } from "@/lib/validations/restaurant";

// GET /api/v1/restaurant — contrato seção 4.1
// Fase 3 (Gestão de Equipe, 2026-08-09): requireSession() -> requireOwner().
// Configurações/Perfil é dado administrativo — staff não deve ver nem por
// leitura (o PATCH abaixo já era requireOwner() desde a Sprint 9).
export async function GET() {
  try {
    const { profile } = await requireOwner();
    const supabase = await createClient();
    const overview = await getRestaurantOverview(supabase, profile.restaurantId);

    return apiSuccess({
      id: overview.id,
      name: overview.name,
      slug: overview.slug,
      status: overview.status,
      trade_name: overview.tradeName,
      phone: overview.phone,
      whatsapp: overview.whatsapp,
      email: overview.email,
      postal_code: overview.postalCode,
      street: overview.street,
      street_number: overview.streetNumber,
      neighborhood: overview.neighborhood,
      city: overview.city,
      state: overview.state,
      instagram: overview.instagram,
      facebook: overview.facebook,
      website: overview.website,
      logo_url: overview.logoUrl,
      description: overview.description,
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
    const {
      name,
      slug,
      trade_name,
      phone,
      whatsapp,
      email,
      postal_code,
      street,
      street_number,
      neighborhood,
      city,
      state,
      instagram,
      facebook,
      website,
      description,
      logo_url,
    } = parseOrThrow(updateRestaurantSchema, body);

    const supabase = await createClient();

    // PATCH parcial: só entra no `update` o que foi de fato enviado —
    // mesmo espírito de `tables/[id]/route.ts` (7.3) e
    // `menu/categories/[id]/route.ts` (5.3). Os 12 campos cadastrais
    // (Sprint "Gestão do Restaurante", 2026-08-07) seguem exatamente o
    // mesmo padrão de `name`/`slug` abaixo.
    const updates: Record<string, string> = {};
    if (name !== undefined) updates.name = name;
    if (slug !== undefined) updates.slug = slug;
    if (trade_name !== undefined) updates.trade_name = trade_name;
    if (phone !== undefined) updates.phone = phone;
    if (whatsapp !== undefined) updates.whatsapp = whatsapp;
    if (email !== undefined) updates.email = email;
    if (postal_code !== undefined) updates.postal_code = postal_code;
    if (street !== undefined) updates.street = street;
    if (street_number !== undefined) updates.street_number = street_number;
    if (neighborhood !== undefined) updates.neighborhood = neighborhood;
    if (city !== undefined) updates.city = city;
    if (state !== undefined) updates.state = state;
    if (instagram !== undefined) updates.instagram = instagram;
    if (facebook !== undefined) updates.facebook = facebook;
    if (website !== undefined) updates.website = website;
    if (description !== undefined) updates.description = description;
    if (logo_url !== undefined) updates.logo_url = logo_url;

    const { data: updated, error } = await supabase
      .from("restaurants")
      .update(updates)
      .eq("id", profile.restaurantId)
      .select(
        "id, name, slug, status, trade_name, phone, whatsapp, email, postal_code, street, street_number, neighborhood, city, state, instagram, facebook, website, logo_url, description",
      )
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
      trade_name: updated.trade_name,
      phone: updated.phone,
      whatsapp: updated.whatsapp,
      email: updated.email,
      postal_code: updated.postal_code,
      street: updated.street,
      street_number: updated.street_number,
      neighborhood: updated.neighborhood,
      city: updated.city,
      state: updated.state,
      instagram: updated.instagram,
      facebook: updated.facebook,
      website: updated.website,
      logo_url: updated.logo_url,
      description: updated.description,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
