import { Frown } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/api/errors";
import { resolveRestaurantBySlug } from "@/lib/orders/resolve-public-context";
import { getPublicOrderStatus } from "@/lib/orders/get-public-order-status";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderTrackingView } from "@/components/cardapio-cliente/order-tracking-view";

export const metadata = { title: "Acompanhar pedido" };

/**
 * Acompanhamento do Pedido (contrato seção 3.4). Carga inicial via
 * `getPublicOrderStatus` (mesma query do Route Handler, sem duplicá-la —
 * mesmo padrão das demais páginas desta Área do Cliente); atualizações
 * seguintes via polling do próprio endpoint público, feito dentro do
 * `<OrderTrackingView>` (Client Component) — ver o comentário lá sobre por
 * que não é uma assinatura Realtime anônima.
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

    return (
      <OrderTrackingView slug={slug} orderId={orderId} restaurantName={restaurant.name} initialOrder={order} />
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
