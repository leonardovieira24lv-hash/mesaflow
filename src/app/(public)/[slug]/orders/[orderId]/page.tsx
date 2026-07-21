export const metadata = { title: "Acompanhar pedido" };

/**
 * Placeholder — Acompanhamento do Pedido. Carga inicial via
 * GET /api/v1/public/{slug}/orders/{order_id} (seção 3.4); atualizações
 * seguintes via Supabase Realtime no canal `orders:id=eq.{orderId}`.
 */
export default async function AcompanharPedidoPage({
  params,
}: {
  params: { slug: string; orderId: string };
}) {
  const { slug, orderId } = params;
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Seu pedido</h1>
      <p className="text-sm text-muted-foreground">
        {slug} · Pedido {orderId} — módulo a implementar.
      </p>
    </div>
  );
}
