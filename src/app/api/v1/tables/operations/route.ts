import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleRouteError } from "@/lib/api/errors";
import { getOpenOrderSessions, getOrdersForSessions } from "@/lib/tables/get-open-table-operations";

/**
 * GET /api/v1/tables/operations — Sprint "Fonte Única de Verdade —
 * order_session" (2026-07-30).
 *
 * Endpoint novo, específico do Painel de Mesas — não é uma variação de
 * `GET /api/v1/orders` (contrato 8.1, inalterado, continua existindo só
 * para o Painel de Pedidos filtrar por status, seu caso de uso real e
 * correto). Este aqui responde a uma pergunta diferente: "quais pedidos
 * pertencem a uma comanda aberta agora, em qualquer mesa deste
 * restaurante" — e isso nunca é decidido por `status`.
 *
 * Histórico do porquê: `tables-manager.tsx` usava
 * `GET /api/v1/orders?status=pending,preparing,ready` para montar o card
 * de cada mesa. Depois da Sprint "Simplificação do Fluxo de Status" (o
 * fluxo passou a permitir marcar `delivered` pedido a pedido, antes da
 * conta fechar), a correção seguinte trocou a lista de status para
 * incluir `delivered` — e isso quebrou de um jeito diferente: `delivered`
 * é permanente, então qualquer pedido antigo de uma sessão já FECHADA
 * (mesa já liberada, possivelmente há dias) continuava aparecendo, porque
 * a query nunca teve nenhum vínculo com "sessão atual" — só com status.
 * Resultado: mesa "Livre" mostrando valor/itens de uma comanda que não
 * existe mais, e o botão "Liberar mesa" incapaz de resolver isso, porque
 * não havia nada de fato pendente para resolver.
 *
 * A causa nunca foi "lista de status errada" — foi usar status pra
 * decidir associação, quando quem já decide isso corretamente é
 * `order_sessions.closed_at`. Este endpoint usa `getOpenOrderSessions`/
 * `getOrdersForSessions` (`lib/tables/get-open-table-operations.ts`) — a
 * mesma dupla de consultas que `GET /api/v1/tables/{id}/close-bill` já
 * usa para uma mesa só — para o restaurante inteiro de uma vez, sem
 * nenhum filtro de status em lugar nenhum. Extraídas para lá exatamente
 * para as duas rotas nunca poderem divergir de novo.
 *
 * Resposta no mesmo formato de `GET /api/v1/orders`
 * (`id, table:{id,name}, status, total_amount, item_count, created_at`) —
 * de propósito: `aggregateByTable()`, em `tables-manager.tsx`, continua
 * exatamente igual, só a URL que ele busca muda.
 */
export async function GET() {
  try {
    const { profile } = await requireSession();
    const supabase = await createClient();

    const sessions = await getOpenOrderSessions(supabase, profile.restaurantId);
    const orders = await getOrdersForSessions(
      supabase,
      sessions.map((session) => session.id),
    );

    return apiSuccess(
      orders.map((order) => ({
        id: order.id,
        table: order.table,
        status: order.status,
        total_amount: order.totalAmount,
        item_count: order.items.length,
        created_at: order.createdAt,
      })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
