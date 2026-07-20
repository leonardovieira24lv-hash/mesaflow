export const metadata = { title: "Pedidos" };

/**
 * Placeholder — Pedidos em Tempo Real (GET /api/v1/orders, seção 8.1),
 * com atualizações subsequentes via Supabase Realtime (canal
 * `restaurant:{id}:orders`), sem polling.
 */
export default function PedidosPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Pedidos em Tempo Real</h1>
      <p className="text-sm text-muted-foreground">Módulo a implementar.</p>
    </div>
  );
}
