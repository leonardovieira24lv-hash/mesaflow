import { Frown } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/api/errors";
import { resolveRestaurantBySlug } from "@/lib/orders/resolve-public-context";
import { EmptyState } from "@/components/ui/empty-state";
import { CarrinhoView } from "@/components/cardapio-cliente/carrinho-view";

export const metadata = { title: "Carrinho" };

/**
 * Página completa do carrinho (Fase 5, itens 1-7). Server Component: só
 * resolve o nome do restaurante para o cabeçalho (mesmo padrão das páginas
 * anteriores) — o carrinho em si mora no `<CartProvider>` (sessionStorage),
 * lido e editado inteiramente no `<CarrinhoView>` (Client Component).
 */
export default async function CarrinhoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mesa?: string }>;
}) {
  const { slug } = await params;
  const { mesa: tableToken } = await searchParams;

  try {
    const admin = createAdminClient();
    const restaurant = await resolveRestaurantBySlug(admin, slug);

    return <CarrinhoView slug={slug} tableToken={tableToken ?? null} restaurantName={restaurant.name} />;
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
