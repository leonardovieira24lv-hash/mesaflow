import { Frown } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/api/errors";
import { resolveRestaurantBySlug, resolveTableByToken } from "@/lib/orders/resolve-public-context";
import { getPublicMenu } from "@/lib/orders/public-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { CardapioClienteView } from "@/components/cardapio-cliente/cardapio-cliente-view";

export const metadata = { title: "Cardápio" };

/**
 * Cardápio do cliente (contrato seção 3.2, Fase 3 itens 2 a 8). Server
 * Component: resolve restaurante e monta o cardápio consultando o Supabase
 * diretamente — mesmo padrão já usado em todo Server Component do painel
 * administrativo (ex.: `app/(admin)/cardapio/produtos/page.tsx`) — e passa
 * tudo pronto para o `<CardapioClienteView>` (Client Component, cuida da
 * interatividade: navegação por categoria, modal de produto, carrinho).
 *
 * `?mesa=` (query string) carrega o `token` da mesa, propagado pela página
 * resolvedora de QR Code (`mesa/[token]/page.tsx`) — usado só para exibir o
 * nome da mesa no cabeçalho e para o carrinho (Fase 4) saber a qual mesa o
 * pedido pertence. Sem ele, o cardápio ainda funciona normalmente (ex.: um
 * link direto compartilhado sem escanear o QR Code) — só não há mesa para
 * mostrar nem para fechar pedido depois.
 */
export default async function CardapioClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mesa?: string }>;
}) {
  const { slug } = await params;
  const { mesa: tableToken } = await searchParams;
  const admin = createAdminClient();

  try {
    const restaurant = await resolveRestaurantBySlug(admin, slug);

    // Resolução da mesa é best-effort: um `?mesa=` inválido ou ausente não
    // impede a navegação pelo cardápio, só significa que o cliente segue
    // sem uma mesa associada (ex.: link compartilhado sem escanear o QR).
    let tableName: string | undefined;
    if (tableToken) {
      try {
        const table = await resolveTableByToken(admin, restaurant.id, tableToken);
        tableName = table.name;
      } catch {
        tableName = undefined;
      }
    }

    const categories = await getPublicMenu(admin, restaurant.id);

    return (
      <CardapioClienteView
        slug={slug}
        tableToken={tableToken ?? null}
        restaurantName={restaurant.name}
        tableName={tableName}
        categories={categories}
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
