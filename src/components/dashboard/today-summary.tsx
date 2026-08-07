import { createClient } from "@/lib/supabase/server";
import { getOrdersTodayCount, getOpenAmount, getTodaySalesSummary, getPreparingOrdersCount } from "@/lib/dashboard/queries";
import { SectionError } from "@/components/dashboard/section-error";
import { formatCurrency } from "@/lib/format";

/**
 * Sprint UI-05 (2026-07-31): "Resumo de hoje" — responde "como foi o dia".
 * Cada métrica na sua própria linha, de propósito (revisão de UX
 * anterior): "prefiro um layout extremamente legível do que economizar
 * uma linha de altura" — nunca condensar tudo numa linha só no mobile.
 *
 * Faturamento/Ticket médio reaproveitam `getTodaySalesSummary`, que por
 * baixo chama `getCashierData` (mesma consulta da tela de Caixa, só com o
 * intervalo "hoje") — nenhum cálculo novo. Valor em aberto reaproveita
 * `getOpenAmount`, que por baixo usa as mesmas funções de
 * `lib/tables/get-open-table-operations.ts` já usadas por Mesas e
 * fechamento de conta.
 *
 * "Pedidos em preparo" (Sprint "Dashboard Executivo", 2026-08-07)
 * reaproveita `getPreparingOrdersCount` — mesmo formato de
 * `getOrdersTodayCount`/`getOpenAmount` acima, só mais um `COUNT` em
 * paralelo, sem regra nova.
 */
export async function TodaySummary({ restaurantId }: { restaurantId: string }) {
  try {
    const supabase = await createClient();
    const [ordersToday, sales, openAmount, preparingCount] = await Promise.all([
      getOrdersTodayCount(supabase, restaurantId),
      getTodaySalesSummary(supabase, restaurantId),
      getOpenAmount(supabase, restaurantId),
      getPreparingOrdersCount(supabase, restaurantId),
    ]);

    const items = [
      { label: "Pedidos hoje", value: String(ordersToday) },
      { label: "Pedidos em preparo", value: String(preparingCount) },
      { label: "Faturamento", value: formatCurrency(sales.revenue) },
      { label: "Ticket médio", value: formatCurrency(sales.averageTicket) },
      { label: "Valor em aberto", value: formatCurrency(openAmount) },
    ];

    return (
      <div className="flex flex-col gap-3">
        <span className="text-sm font-semibold uppercase tracking-wide text-ds2-foreground-muted">Resumo de hoje</span>
        <div className="flex flex-col">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between border-b border-ds2-border py-3 last:border-b-0">
              <span className="text-sm text-ds2-foreground-muted">{item.label}</span>
              <span className="font-numeric text-xl font-bold tabular-nums text-ds2-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  } catch {
    return <SectionError message="Não foi possível carregar o resumo de hoje." />;
  }
}
