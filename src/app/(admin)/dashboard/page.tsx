import { Suspense } from "react";
import { requirePageSession } from "@/lib/auth/require-page-session";
import { RestaurantStatusHeader } from "@/components/dashboard/restaurant-status-header";
import { ActionRequired } from "@/components/dashboard/action-required";
import { OccupiedTables } from "@/components/dashboard/occupied-tables";
import { TodaySummary } from "@/components/dashboard/today-summary";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { DashboardRealtimeSync } from "@/components/dashboard/dashboard-realtime-sync";
import {
  StatusHeaderSkeleton,
  ActionRequiredSkeleton,
  OccupiedTablesSkeleton,
  TodaySummarySkeleton,
  ChecklistSkeleton,
  RecentOrdersSkeleton,
} from "@/components/dashboard/skeletons";

export const metadata = { title: "Início" };

/**
 * Sprint UI-05 (2026-07-31): Dashboard reprojetado — cada seção responde a
 * uma única pergunta (regra 5 da sprint), nesta ordem:
 *
 *  1. Onde estou            → `<RestaurantStatusHeader>`
 *  2. Preciso agir?          → `<ActionRequired>`
 *  3. Como está o salão?     → `<OccupiedTables>`
 *  4. Como foi o dia?        → `<TodaySummary>`
 *  5. O que quero fazer?     → `<QuickActions>` ("Ações rápidas")
 *  6. O que acabou de acontecer? → `<RecentOrders>` (+ `<OnboardingChecklist>`,
 *     prioridade mais baixa, não revisado nesta sprint)
 *
 * `.ds2-dark` aplicado aqui, mesmo padrão e mesma técnica de
 * `tables-manager.tsx` (Sprint UI-02): `-m-4 md:-m-6` cancela o
 * `p-4 md:p-6` do `<main>` em `(admin)/layout.tsx` (intocado), sem vazar
 * a faixa de fundo antigo ao redor. Sidebar/Header continuam no tema atual
 * — fora do escopo desta sprint (Dashboard), tratado numa sprint futura de
 * fundação do shell.
 *
 * Regra 4 desta sprint: os componentes antigos (`SummaryCards`,
 * `SummaryCardsSkeleton`) não foram removidos — só deixaram de ser
 * importados aqui. Continuam no repositório até a validação visual final.
 *
 * Cada seção continua um Server Component assíncrono com seu próprio
 * `<Suspense>` — streaming independente, mesmo padrão desde a Sprint 2.
 * `<DashboardRealtimeSync>` continua chamando `router.refresh()` a cada
 * mudança em `orders`, o que também mantém `<ActionRequired>`/
 * `<OccupiedTables>`/`<TodaySummary>` atualizados sozinhos.
 */
export default async function DashboardPage() {
  const { profile } = await requirePageSession();

  return (
    <div className="ds2-dark -m-4 bg-ds2-background p-4 md:-m-6 md:p-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Suspense fallback={<StatusHeaderSkeleton />}>
            <RestaurantStatusHeader restaurantId={profile.restaurantId} />
          </Suspense>
          <DashboardRealtimeSync restaurantId={profile.restaurantId} />
        </div>

        <Suspense fallback={<ActionRequiredSkeleton />}>
          <ActionRequired restaurantId={profile.restaurantId} />
        </Suspense>

        <Suspense fallback={<OccupiedTablesSkeleton />}>
          <OccupiedTables restaurantId={profile.restaurantId} />
        </Suspense>

        <Suspense fallback={<TodaySummarySkeleton />}>
          <TodaySummary restaurantId={profile.restaurantId} />
        </Suspense>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold text-ds2-foreground">Ações rápidas</h2>
          <QuickActions />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Suspense fallback={<RecentOrdersSkeleton />}>
            <RecentOrders restaurantId={profile.restaurantId} />
          </Suspense>

          <Suspense fallback={<ChecklistSkeleton />}>
            <OnboardingChecklist restaurantId={profile.restaurantId} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
