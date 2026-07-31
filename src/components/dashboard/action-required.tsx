import { CheckCircle2, Bell, Hand, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPendingOrdersCount, getPendingTableEventCounts } from "@/lib/dashboard/queries";
import { SectionError } from "@/components/dashboard/section-error";
import { cn } from "@/lib/utils";

/**
 * Sprint UI-05 (2026-07-31): substitui os antigos cards de resumo
 * (Mesas/Categorias/Produtos/Pedidos hoje, todos administrativos) como
 * primeira coisa vista no Dashboard — responde direto "preciso agir?",
 * antes de qualquer contexto ("onde estou") ou estatística ("como foi o
 * dia"). Componente antigo (`summary-cards.tsx`) não foi removido —
 * regra 4 desta sprint: coexiste no repositório até a validação visual
 * final, só deixou de ser importado por `page.tsx`.
 *
 * Nenhuma contagem nova de verdade: `getPendingOrdersCount` (mesmo
 * critério de `hasUnprocessedOrders`) e `getPendingTableEventCounts`
 * (mesmo critério de `hasWaiterCall`/`bill_request`, `table_events.status
 * = 'open'`) só agregam por restaurante o que já era calculado por mesa.
 *
 * Estado zerado: uma linha discreta, sem cartão/borda/fundo — regra 6
 * desta sprint ("cor só significa ação, nunca decoração"): sem nada
 * pendente, não há ação, então não há cor nem destaque.
 *
 * Estado ativo: prioridade fixa (pedidos aguardando → chamando garçom →
 * pediram a conta), itens zerados somem da lista — mesmas cores já
 * estabelecidas no Painel de Mesas (laranja/verde/vermelho), nunca uma
 * cor nova.
 */
export async function ActionRequired({ restaurantId }: { restaurantId: string }) {
  try {
    const supabase = await createClient();
    const [pendingOrders, eventCounts] = await Promise.all([
      getPendingOrdersCount(supabase, restaurantId),
      getPendingTableEventCounts(supabase, restaurantId),
    ]);

    const items = [
      {
        key: "pending",
        count: pendingOrders,
        label: pendingOrders === 1 ? "pedido aguardando" : "pedidos aguardando",
        icon: Bell,
        colorClass: "text-ds2-warning",
      },
      {
        key: "waiter",
        count: eventCounts.waiterCall,
        label: eventCounts.waiterCall === 1 ? "mesa chamando garçom" : "mesas chamando garçom",
        icon: Hand,
        colorClass: "text-ds2-primary",
      },
      {
        key: "bill",
        count: eventCounts.billRequest,
        label: eventCounts.billRequest === 1 ? "mesa pediu a conta" : "mesas pediram a conta",
        icon: Receipt,
        colorClass: "text-ds2-danger",
      },
    ].filter((item) => item.count > 0);

    if (items.length === 0) {
      return (
        <div className="flex items-center gap-2 text-sm text-ds2-foreground-muted">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          Nenhuma ação pendente
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3 rounded-ds2-lg border border-ds2-border bg-ds2-surface p-4 shadow-ds2-md sm:p-5">
        <span className="text-sm font-semibold uppercase tracking-wide text-ds2-foreground-muted">
          Existem ações pendentes
        </span>
        <ul className="flex flex-col gap-2.5">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-2.5">
              <item.icon className={cn("h-5 w-5 shrink-0", item.colorClass)} aria-hidden />
              <span className="font-numeric text-lg font-bold tabular-nums text-ds2-foreground">{item.count}</span>
              <span className="text-sm text-ds2-foreground-muted">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  } catch {
    return <SectionError message="Não foi possível carregar as pendências agora." />;
  }
}
