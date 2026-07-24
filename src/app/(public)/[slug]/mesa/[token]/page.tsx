import type { Route } from "next";
import { redirect } from "next/navigation";
import { QrCode } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/api/errors";
import { resolveRestaurantBySlug, resolveTableByToken } from "@/lib/orders/resolve-public-context";
import { getActiveOrderForTable } from "@/lib/orders/active-order";
import { EmptyState } from "@/components/ui/empty-state";
import { ROUTES } from "@/constants/routes";
import { withMesaQuery } from "@/lib/cliente-url";

export const metadata = { title: "Bem-vindo" };

/**
 * Ponto de entrada do QR Code (contrato seção 3.1, Fase 3 item 1): resolve
 * restaurante + mesa e decide para onde encaminhar o cliente —
 *   - há um pedido em andamento nesta mesa → acompanhamento (Fase 4);
 *   - senão → cardápio, levando o `token` da mesa junto via `?mesa=` para
 *     que o carrinho (item 8 desta fase) já saiba a qual mesa o pedido vai
 *     pertencer quando a finalização existir (Fase 4).
 *
 * Nunca renderiza conteúdo próprio em caso de sucesso — só decide e
 * redireciona. `resolveRestaurantBySlug`/`resolveTableByToken` (Fase 2) e
 * `getActiveOrderForTable` (extraído nesta fase de dentro do Route Handler
 * de `tables/[token]`, sem duplicar a query) são reaproveitados diretamente
 * — mesmo padrão já usado em todo Server Component do painel administrativo
 * (consulta o Supabase direto, não a própria API).
 */
export default async function ResolverMesaPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const admin = createAdminClient();

  let target: Route;

  try {
    const restaurant = await resolveRestaurantBySlug(admin, slug);
    const table = await resolveTableByToken(admin, restaurant.id, token);
    const activeOrder = await getActiveOrderForTable(admin, table.id);

    target = activeOrder
      ? ROUTES.clienteAcompanharPedido(slug, activeOrder.id)
      : withMesaQuery(ROUTES.clienteMenu(slug), token);
  } catch (err) {
    if (err instanceof AppError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <EmptyState
            icon={QrCode}
            title="QR Code inválido"
            description="Não encontramos esta mesa. Confira com o atendente do restaurante."
          />
        </div>
      );
    }
    throw err;
  }

  redirect(target);
}
