import { Frown } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/api/errors";
import { resolveRestaurantBySlug } from "@/lib/orders/resolve-public-context";
import { getPublicOrderStatus } from "@/lib/orders/get-public-order-status";
import { getOrderTableContext } from "@/lib/orders/get-order-table-context";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderTrackingView } from "@/components/cardapio-cliente/order-tracking-view";

export const metadata = { title: "Acompanhar pedido" };

// Sprint de Correção de Regressões Críticas — mesma causa raiz do Bug 5
// (ver `mesa/[token]/page.tsx`): só cliente admin, sem API dinâmica do
// Next, sujeita a cache estático — a carga inicial podia mostrar um status
// desatualizado até o polling client-side alcançar, ou pior, uma página de
// "pedido não encontrado" em cache para um pedido recém-criado.
export const dynamic = "force-dynamic";

/**
 * Acompanhamento do Pedido (contrato seção 3.4). Carga inicial via
 * `getPublicOrderStatus` (mesma query do Route Handler, sem duplicá-la —
 * mesmo padrão das demais páginas desta Área do Cliente); atualizações
 * seguintes via polling do próprio endpoint público, feito dentro do
 * `<OrderTrackingView>` (Client Component) — ver o comentário lá sobre por
 * que não é uma assinatura Realtime anônima.
 *
 * Sprint "Continuar Comprando" (2026-07-31): `getOrderTableContext` roda
 * só nesta carga inicial (Server Component), fora do contrato 3.4 —
 * resolve o `token` da mesa e se a `order_session` ainda está aberta, para
 * `<OrderTrackingView>` decidir se mostra o botão de volta ao cardápio.
 * Best-effort: se não conseguir resolver (pedido sem mesa associada, num
 * caso hipotético), a tela de acompanhamento continua funcionando
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

    const tableContext = await getOrderTableContext(admin, restaurant.id, orderId);

    return (
      <OrderTrackingView
        slug={slug}
        orderId={orderId}
        restaurantName={restaurant.name}
        initialOrder={order}
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
