import { Frown } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/api/errors";
import { resolveRestaurantBySlug, getRestaurantDisplayName } from "@/lib/orders/resolve-public-context";
import { getPublicOrderStatus } from "@/lib/orders/get-public-order-status";
import { getPublicSessionOrders } from "@/lib/orders/get-public-session-orders";
import { getOrderTableContext } from "@/lib/orders/get-order-table-context";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderTrackingView } from "@/components/cardapio-cliente/order-tracking-view";

export const metadata = { title: "Sua comanda" };

// Sprint de Correção de Regressões Críticas — mesma causa raiz do Bug 5
// (ver `mesa/[token]/page.tsx`): só cliente admin, sem API dinâmica do
// Next, sujeita a cache estático — a carga inicial podia mostrar um status
// desatualizado até o polling client-side alcançar, ou pior, uma página de
// "pedido não encontrado" em cache para um pedido recém-criado.
export const dynamic = "force-dynamic";

/**
 * Acompanhamento da Comanda. Carga inicial via `getPublicOrderStatus`
 * (contrato seção 3.4, mesma query do Route Handler, sem duplicá-la —
 * inalterada desde a Fase 2) só para o *gate* de "pedido não encontrado" —
 * mantido de propósito, sem tocar num caminho já estabilizado.
 *
 * Sprint "Evolução da Área do Cliente (Comanda)" (2026-07-31):
 * `getPublicSessionOrders` roda em seguida (reaproveita `getOrdersForSessions`,
 * `lib/tables/get-open-table-operations.ts` — ver o comentário lá) e traz
 * TODOS os pedidos da mesma `order_session`, não só este. Atualizações
 * seguintes via polling do endpoint novo
 * (`GET /api/v1/public/{slug}/orders/{orderId}/session`), dentro de
 * `<OrderTrackingView>` — o contrato 3.4 em si nunca é chamado de novo
 * depois da carga inicial.
 *
 * Sprint "Continuar Comprando" (2026-07-31): `getOrderTableContext` resolve
 * o `token` da mesa e se a `order_session` ainda está aberta, para
 * `<OrderTrackingView>` decidir se mostra o botão de volta ao cardápio.
 * Best-effort: se não conseguir resolver, a tela continua funcionando
 * normalmente, só sem o botão.
 */
export default async function AcompanharPedidoPage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>;
}) {
  const { slug, orderId } = await params;

  try {
    const admin = createAdminClient();
    const restaurant = await resolveRestaurantBySlug(admin, slug);
    const order = await getPublicOrderStatus(admin, restaurant.id, orderId);

    if (!order) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <EmptyState
            icon={Frown}
            title="Pedido não encontrado"
            description="Verifique o link ou fale com o atendente do restaurante."
          />
        </div>
      );
    }

    const [tableContext, sessionOrders] = await Promise.all([
      getOrderTableContext(admin, restaurant.id, orderId),
      getPublicSessionOrders(admin, restaurant.id, orderId),
    ]);

    return (
      <OrderTrackingView
        slug={slug}
        orderId={orderId}
        restaurantName={getRestaurantDisplayName(restaurant)}
        restaurantLogoUrl={restaurant.logoUrl}
        initialOrders={sessionOrders ?? [{ id: order.id, status: order.status, items: order.items, totalAmount: 0, createdAt: new Date().toISOString() }]}
        tableToken={tableContext?.isSessionOpen ? tableContext.tableToken : null}
      />
    );
  } catch (err) {
    if (err instanceof AppError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <EmptyState
            icon={Frown}
            title="Restaurante não encontrado"
            description="Verifique o link ou escaneie novamente o QR Code da mesa."
          />
        </div>
      );
    }
    throw err;
  }
}
