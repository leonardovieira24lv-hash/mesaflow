export const metadata = { title: "Detalhes do Pedido" };

/**
 * Placeholder — Detalhes do Pedido (GET /api/v1/orders/{id}, seção 8.2),
 * com inscrição no canal `orders:id=eq.{id}` para refletir mudanças de
 * outro atendente em tempo real.
 */
export default async function PedidoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Pedido {id}</h1>
      <p className="text-sm text-muted-foreground">Módulo a implementar.</p>
    </div>
  );
}
