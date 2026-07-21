export const metadata = { title: "Bem-vindo" };

/**
 * Placeholder — ponto de entrada do QR Code: resolve a mesa
 * (GET /api/v1/public/{slug}/tables/{token}, seção 3.1) e decide se retoma
 * um pedido ativo ou encaminha para o cardápio.
 */
export default async function ResolverMesaPage({
  params,
}: {
  params: { slug: string; token: string };
}) {
  const { slug, token } = params;
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Bem-vindo</h1>
      <p className="text-sm text-muted-foreground">
        Restaurante: {slug} · Mesa: {token} — módulo a implementar.
      </p>
    </div>
  );
}
