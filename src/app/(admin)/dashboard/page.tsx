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
import { AccessDeniedToast } from "@/components/dashboard/access-denied-toast";
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
 * Dashboard reprojetado (Sprint UI-05) — cada seção responde a uma única
 * pergunta:
 *
 *  1. Onde estou            → `<RestaurantStatusHeader>`
 *  2. Preciso agir?          → `<ActionRequired>`
 *  3. Como está o salão?     → `<OccupiedTables>`
 *  4. Como foi o dia?        → `<TodaySummary>`
 *  5. O que quero fazer?     → `<QuickActions>` ("Ações rápidas")
 *  6. O que acabou de acontecer? → `<RecentOrders>` (+ `<OnboardingChecklist>`,
 *     prioridade mais baixa)
 *
 * Cada seção é um Server Component assíncrono com seu próprio
 * `<Suspense>` — streaming independente. `<DashboardRealtimeSync>` chama
 * `router.refresh()` a cada mudança em `orders`, o que também mantém
 * `<ActionRequired>`/`<OccupiedTables>`/`<TodaySummary>` atualizados
 * sozinhos.
 *
 * `SummaryCards`/`SummaryCardsSkeleton` (componentes antigos, substituídos
 * pelas seções acima) não foram removidos do repositório — só deixaram de
 * ser importados aqui.
 */
export default async function DashboardPage() {
  const { profile } = await requirePageSession();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Suspense fallback={<StatusHeaderSkeleton />}>
          <RestaurantStatusHeader restaurantId={profile.restaurantId} />
        </Suspense>
        <DashboardRealtimeSync restaurantId={profile.restaurantId} />
        <Suspense fallback={null}>
          <AccessDeniedToast />
        </Suspense>
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
  );
}
