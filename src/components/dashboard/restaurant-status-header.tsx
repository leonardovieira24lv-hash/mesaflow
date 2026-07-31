import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantOverview } from "@/lib/restaurant/get-restaurant-overview";
import { RestaurantStatusBadge } from "@/components/ui/badge";
import { SectionError } from "@/components/dashboard/section-error";

/**
 * Cabeçalho do Dashboard: nome do restaurante, status e link para o
 * cardápio público. Server Component assíncrono, isolado em `<Suspense>`
 * próprio no `page.tsx` — o resto da tela renderiza mesmo se isto demorar.
 *
 * Usa `RestaurantStatusBadge` (`components/ui/badge.tsx`) — única fonte
 * de verdade para o texto de status do restaurante, usado também em
 * `restaurant-settings-form.tsx` (Configurações).
 */
export async function RestaurantStatusHeader({ restaurantId }: { restaurantId: string }) {
  try {
    const supabase = await createClient();
    const overview = await getRestaurantOverview(supabase, restaurantId);

    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ds2-foreground sm:text-4xl">
            {overview.name}
          </h1>
          <RestaurantStatusBadge status={overview.status} />
        </div>
        <a
          href={`/${overview.slug}/menu`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit items-center gap-1.5 rounded-ds2-full bg-ds2-surface-hover px-3 py-1 font-numeric text-sm text-ds2-foreground-muted transition-colors hover:bg-ds2-primary/10 hover:text-ds2-primary"
        >
          /{overview.slug}/menu
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
    );
  } catch {
    return <SectionError message="Não foi possível carregar os dados do restaurante." />;
  }
}
