import { requirePageSession } from "@/lib/auth/require-page-session";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantOverview } from "@/lib/restaurant/get-restaurant-overview";
import { RestaurantSettingsForm } from "@/components/configuracoes/restaurant-settings-form";

export const metadata = { title: "Configurações" };

/**
 * Configurações do Restaurante (contrato seção 4.2, Sprint 9). Carrega o
 * restaurante atual aqui (Server Component lendo direto do Supabase via
 * `getRestaurantOverview` — mesma função já usada pelo Dashboard e por
 * `GET /api/v1/restaurant`, evitando um round-trip HTTP da própria página
 * para a própria API, mesmo raciocínio documentado no módulo de Dashboard)
 * e entrega para `<RestaurantSettingsForm>`, que cuida de toda a edição.
 */
export default async function ConfiguracoesPage() {
  const { profile } = await requirePageSession();
  const supabase = await createClient();
  const overview = await getRestaurantOverview(supabase, profile.restaurantId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie o nome e o slug do restaurante.
        </p>
      </div>

      <RestaurantSettingsForm
        restaurant={{
          id: overview.id,
          name: overview.name,
          slug: overview.slug,
          status: overview.status,
        }}
      />
    </div>
  );
}
