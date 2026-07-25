import { Frown } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/api/errors";
import { resolveRestaurantBySlug, resolveTableByToken } from "@/lib/orders/resolve-public-context";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckoutView } from "@/components/cardapio-cliente/checkout-view";

export const metadata = { title: "Confirmar pedido" };

/**
 * Tela de checkout (Fase 5, itens 8-12). Server Component: resolve
 * restaurante e (se houver `?mesa=`) o nome da mesa para o cabeçalho — mesmo
 * padrão da página do cardápio (Fase 3). O carrinho em si e a chamada de
 * criação do pedido acontecem inteiramente no `<CheckoutView>` (Client
 * Component).
 */
export default async function CheckoutPage({
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

    let tableName: string | undefined;
    if (tableToken) {
      try {
        const table = await resolveTableByToken(admin, restaurant.id, tableToken);
        tableName = table.name;
      } catch {
        tableName = undefined;
      }
    }

    return (
      <CheckoutView
        slug={slug}
        tableToken={tableToken ?? null}
        restaurantName={restaurant.name}
        tableName={tableName}
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
