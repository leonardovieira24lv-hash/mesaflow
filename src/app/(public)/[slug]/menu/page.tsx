export const metadata = { title: "Cardápio" };

/** Placeholder — Cardápio do cliente (GET /api/v1/public/{slug}/menu, seção 3.2). */
export default async function CardapioClientePage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Cardápio — {slug}</h1>
      <p className="text-sm text-muted-foreground">Módulo a implementar.</p>
    </div>
  );
}
