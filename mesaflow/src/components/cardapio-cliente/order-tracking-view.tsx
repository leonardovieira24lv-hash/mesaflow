"use client";

import { useEffect, useState } from "react";
import { RestaurantHeader } from "@/components/cardapio-cliente/restaurant-header";
import { OrderStatusBadge } from "@/components/ui/badge";
import { OrderStatusTimeline } from "@/components/cardapio-cliente/order-status-timeline";
import type { PublicOrderStatus } from "@/lib/orders/get-public-order-status";
import type { ApiSuccess } from "@/types/api";
import type { OrderStatus } from "@/types/domain";

interface OrderTrackingViewProps {
  slug: string;
  orderId: string;
  restaurantName: string;
  initialOrder: PublicOrderStatus;
}

const POLL_INTERVAL_MS = 5_000;
const TERMINAL_STATUSES: OrderStatus[] = ["delivered", "cancelled"];

/**
 * Tela de acompanhamento do pedido.
 *
 * Nota sobre "Realtime, caso disponível" (pedido pela Sprint): a
 * infraestrutura de Realtime já existe — a migration 0007 publica `orders`
 * no `supabase_realtime` — mas ela só é segura para uma conexão
 * AUTENTICADA. As políticas de RLS criadas até agora
 * (`select_own_orders`/`select_own_order_items`) exigem `auth.uid()` via
 * `profiles`; não existe (nem deveria existir) uma política de SELECT
 * pública nessas tabelas. Como o Supabase expõe uma REST API automática
 * para toda tabela, qualquer política que permitisse a um cliente anônimo
 * assinar `postgres_changes` em `orders` também permitiria a qualquer pessoa
 * com a chave anônima (pública, embutida no bundle do site) listar os
 * pedidos de TODOS os restaurantes via `/rest/v1/orders` — um vazamento
 * entre clientes que a Fase 1 nunca autorizou. Por isso esta tela atualiza
 * via polling do endpoint já existente
 * (`GET /api/v1/public/{slug}/orders/{orderId}`, seção 3.4 — já seguro,
 * usa a service role) em vez de abrir uma assinatura Realtime anônima. Uma
 * alternativa segura para Realtime "de verdade" aqui (Realtime Broadcast por
 * canal autorizado, não `postgres_changes` bruto) fica registrada como
 * pendência para a próxima Sprint.
 */
export function OrderTrackingView({ slug, orderId, restaurantName, initialOrder }: OrderTrackingViewProps) {
  const [order, setOrder] = useState<PublicOrderStatus>(initialOrder);
  const isTerminal = TERMINAL_STATUSES.includes(order.status);

  useEffect(() => {
    if (isTerminal) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/public/${slug}/orders/${orderId}`);
        if (!response.ok) return;

        const body = (await response.json()) as ApiSuccess<PublicOrderStatus>;
        setOrder(body.data);
      } catch {
        // Falha de rede num poll isolado não é crítica — a tentativa seguinte
        // (5s depois) corrige sozinha; não há necessidade de mostrar erro por
        // uma única requisição perdida.
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [slug, orderId, isTerminal]);

  return (
    <div className="flex min-h-screen flex-col">
      <RestaurantHeader restaurantName={restaurantName} />

      <main className="flex flex-1 flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-xl font-semibold text-foreground">Seu pedido</h1>
          <p className="font-mono text-xs text-muted-foreground">#{order.id.slice(0, 8)}</p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
          <span className="text-sm font-medium text-foreground">Status atual</span>
          <OrderStatusBadge status={order.status} />
        </div>

        <OrderStatusTimeline status={order.status} />

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-foreground">Itens</h2>
          <ul className="flex flex-col gap-2">
            {order.items.map((item, index) => (
              <li
                key={`${item.name}-${index}`}
                className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 text-sm"
              >
                <span className="text-foreground">{item.name}</span>
                <span className="font-mono text-muted-foreground">×{item.quantity}</span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
