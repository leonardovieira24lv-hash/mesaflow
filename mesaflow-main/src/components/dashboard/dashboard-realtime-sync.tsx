"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { restaurantOrdersChannel } from "@/lib/realtime/channels";
import { useRealtimeConnectionStatus } from "@/lib/realtime/use-realtime-connection-status";
import { RealtimeStatusIndicator } from "@/components/realtime/realtime-status-indicator";

/**
 * Sprint 2 (Painel Vivo) — Dashboard em tempo real.
 *
 * O Dashboard inteiro é Server Component (streaming por seção, cada uma
 * com seu próprio `<Suspense>` — ver `page.tsx`). Em vez de duplicar as
 * queries de `SummaryCards`/`RecentOrders` num client component só para
 * ter Realtime, este componente assina o mesmo canal `restaurant:{id}:orders`
 * que Mesas e Pedidos já usam (nenhum canal novo, nenhum endpoint novo) e
 * chama `router.refresh()` quando algo muda. O Next.js então re-executa os
 * Server Components no servidor e troca o conteúdo via transição — os
 * `<Suspense>` já resolvidos não voltam a mostrar o skeleton nesse caso,
 * então a tela atualiza sem piscar (mesmo espírito das "microinterações
 * suaves" pedidas para o resto da sprint).
 *
 * Debounce de 400ms: evita um `router.refresh()` por item quando um pedido
 * com vários itens é criado de uma vez (ou vários pedidos chegam juntos).
 */
export function DashboardRealtimeSync({ restaurantId }: { restaurantId: string }) {
  const router = useRouter();
  const { status, reportStatus } = useRealtimeConnectionStatus(["orders"]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(restaurantOrdersChannel(restaurantId))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => router.refresh(), 400);
        },
      )
      .subscribe((subscriptionStatus) => reportStatus("orders", subscriptionStatus));

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void supabase.removeChannel(channel);
    };
  }, [restaurantId, router, reportStatus]);

  return <RealtimeStatusIndicator status={status} />;
}
