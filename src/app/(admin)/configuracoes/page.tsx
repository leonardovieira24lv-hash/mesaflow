import { requirePageSession } from "@/lib/auth/require-page-session";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantOverview } from "@/lib/restaurant/get-restaurant-overview";
import { RestaurantSettingsForm } from "@/components/configuracoes/restaurant-settings-form";

export const metadata = { title: "Perfil do Restaurante" };

/**
 * Configurações do Restaurante (contrato seção 4.2, Sprint 9). Carrega o
 * restaurante atual aqui (Server Component lendo direto do Supabase via
 * `getRestaurantOverview` — mesma função já usada pelo Dashboard e por
 * `GET /api/v1/restaurant`, evitando um round-trip HTTP da própria página
 * para a própria API, mesmo raciocínio documentado no módulo de Dashboard)
 * e entrega para `<RestaurantSettingsForm>`, que cuida de toda a edição.
 *
 * Sprint "Perfil do Restaurante, Fase 1" (2026-08-09): título/descrição da
 * página atualizados para refletir a reorganização; `logoUrl`/`description`
 * (colunas novas, `0026_restaurant_logo_and_description.sql`) passados ao
 * formulário junto com os demais campos.
 */
export default async function ConfiguracoesPage() {
  const { profile } = await requirePageSession();
  const supabase = await createClient();
  const overview = await getRestaurantOverview(supabase, profile.restaurantId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold">Perfil do Restaurante</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie a identidade, o contato e o endereço do restaurante.
        </p>
      </div>

      <RestaurantSettingsForm
        restaurant={{
          id: overview.id,
          name: overview.name,
          slug: overview.slug,
          status: overview.status,
          tradeName: overview.tradeName,
          phone: overview.phone,
          whatsapp: overview.whatsapp,
          email: overview.email,
          postalCode: overview.postalCode,
          street: overview.street,
          streetNumber: overview.streetNumber,
          neighborhood: overview.neighborhood,
          city: overview.city,
          state: overview.state,
          instagram: overview.instagram,
          facebook: overview.facebook,
          website: overview.website,
          logoUrl: overview.logoUrl,
          description: overview.description,
        }}
      />
    </div>
  );
}
