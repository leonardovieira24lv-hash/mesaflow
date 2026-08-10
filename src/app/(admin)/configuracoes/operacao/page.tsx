import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/auth/require-page-session";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantOverview } from "@/lib/restaurant/get-restaurant-overview";
import { OperacaoManager } from "@/components/configuracoes/operacao-manager";
import { ROUTES } from "@/constants/routes";

export const metadata = { title: "Operação" };

/**
 * Operação (Fase 4A, 2026-08-10) — só `owner`, mesmo padrão de
 * `equipe/page.tsx`: `requirePageSession()` garante sessão+profile válidos,
 * o `redirect` abaixo é a checagem adicional de `role`. Reforça (não
 * substitui) a proteção real, que é o `requireOwner()` em
 * `GET/PATCH /api/v1/restaurant`.
 */
export default async function OperacaoPage() {
  const { profile } = await requirePageSession();
  if (profile.role !== "owner") {
    redirect(ROUTES.dashboard);
  }

  const supabase = await createClient();
  const overview = await getRestaurantOverview(supabase, profile.restaurantId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold">Operação</h1>
        <p className="text-sm text-muted-foreground">Horário de funcionamento e formas de pagamento aceitas.</p>
      </div>

      <OperacaoManager
        initialOpeningHours={overview.openingHours}
        initialAcceptedPaymentMethods={overview.acceptedPaymentMethods}
        initialTimezone={overview.timezone}
      />
    </div>
  );
}
