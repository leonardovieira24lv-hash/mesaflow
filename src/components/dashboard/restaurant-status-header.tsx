import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantOverview } from "@/lib/restaurant/get-restaurant-overview";
import { Badge } from "@/components/ui/badge";
import { SectionError } from "@/components/dashboard/section-error";

/**
 * Sprint UI-05 (2026-07-31): rótulo evoluiu de "Ativo" (linguagem de status
 * de conta/sistema) para "Recebendo pedidos" (o que está de fato
 * acontecendo, na língua do dono) — aprovado na revisão de linguagem que
 * antecedeu esta sprint.
 *
 * Continua um mapa (`Record<RestaurantStatus, ...>`), não um `if/else` —
 * de propósito: `RestaurantStatus` hoje só tem `"onboarding" | "active"`,
 * mas o pedido foi deixar isto "preparado para futuras variações"
 * (Pausado, Fechado). Nenhuma mudança de banco/regra de negócio nesta
 * sprint — só a estrutura já pronta para que um valor novo no tipo vire
 * uma entrada nova aqui, não uma reescrita do componente.
 */
const STATUS_CONFIG = {
  onboarding: { label: "Ainda configurando", variant: "warning" as const },
  active: { label: "Recebendo pedidos", variant: "success" as const },
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
          <h1 className="font-display text-3xl font-bold tracking-tight text-ds2-foreground sm:text-4xl">
            {overview.name}
          </h1>
          <Badge variant={status.variant} dot>
            {status.label}
          </Badge>
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
