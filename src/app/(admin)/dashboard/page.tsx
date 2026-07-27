import { Suspense } from "react";
import { requirePageSession } from "@/lib/auth/require-page-session";
import { RestaurantStatusHeader } from "@/components/dashboard/restaurant-status-header";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { DashboardRealtimeSync } from "@/components/dashboard/dashboard-realtime-sync";
import {
  StatusHeaderSkeleton,
  SummaryCardsSkeleton,
  ChecklistSkeleton,
  RecentOrdersSkeleton,
} from "@/components/dashboard/skeletons";

export const metadata = { title: "Dashboard" };

/**
 * Dashboard principal. Cada seção é um Server Component assíncrono com o
 * seu próprio `<Suspense>` — a tela aparece por partes (streaming), cada
 * uma com seu skeleton, e uma seção lenta ou com erro nunca trava as
 * outras. `restaurantId` é resolvido uma única vez aqui (via
 * `requirePageSession`, com `cache()`) e passado como prop para quem
 * precisa — nenhum componente filho refaz essa consulta.
 *
 * Sprint 2 (Painel Vivo): `<DashboardRealtimeSync>` assina o Realtime de
 * pedidos do restaurante e chama `router.refresh()` nas mudanças — todas
 * as seções acima (incluindo "Pedidos hoje" em `SummaryCards` e a lista em
 * `RecentOrders`) passam a atualizar sozinhas, sem duplicar nenhuma query.
 */
export default async function DashboardPage() {
  const { profile } = await requirePageSession();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Suspense fallback={<StatusHeaderSkeleton />}>
          <RestaurantStatusHeader restaurantId={profile.restaurantId} />
        </Suspense>
        <DashboardRealtimeSync restaurantId={profile.restaurantId} />
      </div>

      <Suspense fallback={<SummaryCardsSkeleton />}>
        <SummaryCards restaurantId={profile.restaurantId} />
      </Suspense>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">Atalhos</h2>
        <QuickActions />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<ChecklistSkeleton />}>
          <OnboardingChecklist restaurantId={profile.restaurantId} />
        </Suspense>

        <Suspense fallback={<RecentOrdersSkeleton />}>
          <RecentOrders restaurantId={profile.restaurantId} />
        </Suspense>
      </div>
    </div>
  );
}
