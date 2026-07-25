import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantOverview } from "@/lib/restaurant/get-restaurant-overview";
import { Badge } from "@/components/ui/badge";
import { SectionError } from "@/components/dashboard/section-error";

const STATUS_CONFIG = {
  onboarding: { label: "Configuração em andamento", variant: "warning" as const },
  active: { label: "Ativo", variant: "success" as const },
};

/**
 * Cabeçalho do Dashboard: nome do restaurante, status e link para o
 * cardápio público. Server Component assíncrono, isolado em `<Suspense>`
 * próprio no `page.tsx` — o resto da tela renderiza mesmo se isto demorar.
 */
export async function RestaurantStatusHeader({ restaurantId }: { restaurantId: string }) {
  try {
    const supabase = await createClient();
    const overview = await getRestaurantOverview(supabase, restaurantId);
    const status = STATUS_CONFIG[overview.status];

    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{overview.name}</h1>
          <Badge variant={status.variant} dot>
            {status.label}
          </Badge>
        </div>
        <a
          href={`/${overview.slug}/menu`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-mono text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
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
