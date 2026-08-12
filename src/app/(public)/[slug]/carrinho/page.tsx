import { Frown } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/api/errors";
import { resolveRestaurantBySlug, resolveTableByToken, getRestaurantDisplayName } from "@/lib/orders/resolve-public-context";
import { EmptyState } from "@/components/ui/empty-state";
import { CarrinhoView } from "@/components/cardapio-cliente/carrinho-view";

export const metadata = { title: "Carrinho" };

// Sprint de Correção de Regressões Críticas — mesma causa raiz do Bug 5
// (ver `mesa/[token]/page.tsx`): só cliente admin, sem API dinâmica do
// Next, sujeita a cache estático (nome de mesa desatualizado, por exemplo,
// depois de uma edição).
export const dynamic = "force-dynamic";

/**
 * Página completa do carrinho (Fase 5, itens 1-7). Server Component: resolve
 * o nome do restaurante e, se houver `?mesa=`, o nome da mesa para o
 * cabeçalho — mesmo padrão da página de Checkout (Marco 2: antes só o
 * Checkout resolvia a mesa; o cliente revisava o carrinho sem ver para qual
 * mesa estava pedindo até chegar na confirmação). O carrinho em si mora no
 * `<CartProvider>` (sessionStorage), lido e editado inteiramente no
 * `<CarrinhoView>` (Client Component).
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
      <CarrinhoView
        slug={slug}
        tableToken={tableToken ?? null}
        restaurantName={getRestaurantDisplayName(restaurant)}
        restaurantLogoUrl={restaurant.logoUrl}
        menuTheme={restaurant.menuTheme}
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
