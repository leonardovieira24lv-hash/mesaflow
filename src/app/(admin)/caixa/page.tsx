import { requirePageSession } from "@/lib/auth/require-page-session";
import { createClient } from "@/lib/supabase/server";
import { getCashierData, resolveCashierDateRange } from "@/lib/cashier/queries";
import { CaixaManager } from "@/components/caixa/caixa-manager";

export const metadata = { title: "Caixa" };

const DEFAULT_PER_PAGE = 20;

/**
 * Painel de Caixa (Sprint "Painel de Caixa", 2026-07-30) — histórico
 * permanente de comandas finalizadas. Reaproveita `order_sessions`
 * (`closed_at`/`payment_method`, já existentes desde a sprint de
 * fechamento de conta) — nenhuma tabela nova.
 *
 * Carrega o período padrão ("Hoje") no servidor, igual ao padrão já usado
 * em `/cardapio/categorias`; trocar de período/busca depois disso chama
 * `GET /api/v1/cashier` a partir do `<CaixaManager>` (client).
 */
export default async function CaixaPage() {
  const { profile } = await requirePageSession();
  const supabase = await createClient();

  const { from, to } = resolveCashierDateRange("today");
  const initialData = await getCashierData(supabase, profile.restaurantId, {
    from,
    to,
    page: 1,
    perPage: DEFAULT_PER_PAGE,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold">Caixa</h1>
        <p className="text-sm text-muted-foreground">Histórico de comandas finalizadas.</p>
      </div>

      <CaixaManager initialData={initialData} initialPeriod="today" />
    </div>
  );
}
