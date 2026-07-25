import { Suspense } from "react";
import { requirePageSession } from "@/lib/auth/require-page-session";
import { RestaurantStatusHeader } from "@/components/dashboard/restaurant-status-header";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { QuickActions } from "@/components/dashboard/quick-actions";
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
 */
export default async function DashboardPage() {
  const { profile } = await requirePageSession();

  return (
    <div className="flex flex-col gap-8">
      <Suspense fallback={<StatusHeaderSkeleton />}>
        <RestaurantStatusHeader restaurantId={profile.restaurantId} />
      </Suspense>

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
