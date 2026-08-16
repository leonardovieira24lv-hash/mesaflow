import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/auth/require-page-session";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantOverview } from "@/lib/restaurant/get-restaurant-overview";
import { RestaurantSettingsForm } from "@/components/configuracoes/restaurant-settings-form";
import { ROUTES } from "@/constants/routes";

export const metadata = { title: "Perfil do Restaurante" };

/**
 * Perfil do Restaurante (contrato seção 4.2, Sprint 9) — antes vivia
 * direto em `/configuracoes` (conteúdo + os atalhos "Operação"/"Equipe"
 * lado a lado no topo). Reorganização "Configurações em 3 blocos
 * simétricos" (2026-08-15, pedido do dono com mockup aprovado antes de
 * codar): `/configuracoes` virou um hub simples com 3 opções iguais
 * (Perfil/Operação/Equipe) — o conteúdo em si (busca de dados +
 * `<RestaurantSettingsForm>`) só mudou de endereço pra cá, sem nenhuma
 * mudança de lógica. Os botões de atalho pro topo saíram porque não
 * fazem mais sentido aqui: "Perfil" agora é irmã de "Operação"/"Equipe",
 * não a página que as duas "penduram" em cima.
 */
export default async function PerfilRestaurantePage() {
  const { profile } = await requirePageSession();
  if (profile.role !== "owner") {
    redirect(`${ROUTES.dashboard}?blocked=configuracoes`);
  }

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
          promoBannerImageUrl: overview.promoBannerImageUrl,
          promoBannerText: overview.promoBannerText,
          promoBannerEnabled: overview.promoBannerEnabled,
        }}
      />
    </div>
  );
}
