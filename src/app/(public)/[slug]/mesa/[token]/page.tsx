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

// Sprint de Correção de Regressões Críticas — Bug 5 ("QR Code funciona
// apenas na primeira utilização"): esta página nunca chama nenhuma API
// dinâmica do Next (sem `cookies()`/`headers()` — usa só o cliente admin,
// que fala direto com o Supabase por HTTP). Sem nenhum sinal de que precisa
// rodar por requisição, o Next.js a trata como estática por padrão: a
// PRIMEIRA vez que alguém escaneava o QR Code, o resultado (para onde
// redirecionar) ficava em cache — toda leitura seguinte da mesma URL
// (mesmo `qr_token`, que nunca muda) devolvia o MESMO redirecionamento em
// cache, ignorando se um pedido novo tinha sido criado, se a mesa entrou em
// manutenção, ou qualquer outra mudança real no banco desde então. Essa é a
// causa raiz — nada errado na geração da URL, no `qr_token` ou no
// middleware. `force-dynamic` garante que esta decisão (cardápio vs.
// acompanhamento de pedido vs. mesa indisponível) seja recalculada a cada
// escaneada, sempre contra o estado real do banco.
export const dynamic = "force-dynamic";

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
      // Sprint 1 de Correção: mesa em manutenção é um caso diferente de "QR
      // inválido" — a mesa foi encontrada normalmente, só não está
      // disponível agora. Mostrar a mensagem genérica de QR inválido aqui
      // seria confuso e incorreto (o código do cliente não fez nada errado).
      if (err.code === "CONFLICT") {
        return (
          <div className="flex min-h-screen items-center justify-center p-6">
            <EmptyState icon={QrCode} title="Mesa indisponível" description={err.message} />
          </div>
        );
      }

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
