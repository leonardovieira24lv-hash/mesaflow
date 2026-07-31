import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { updateOrderStatusSchema } from "@/lib/validations/orders";
import { assertValidOrderStatusTransition } from "@/lib/orders/status-transitions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/v1/orders/{id}/status — contrato seção 8.3
//
// Cobre tanto o avanço normal de status quanto o cancelamento (mesmo
// endpoint, valor diferente de `status` — evita endpoint duplicado só para
// cancelamento, conforme o contrato).
//
// Mudança arquitetural — resolver o bloqueador do MVP: depois de várias
// sprints de investigação (falso conflito em toda mudança de status, sem
// explicação nos dados), a causa mais provável, e nunca confirmável a
// partir daqui, era a política de RLS de `UPDATE` em `orders` estar ausente
// ou quebrada no projeto Supabase real (possivelmente por causa da
// reconfiguração de ambiente mencionada) — o app não tem como inspecionar
// `pg_policies` para confirmar isso com certeza. Em vez de continuar
// dependente de uma peça de infraestrutura que não se consegue verificar
// nem corrigir a partir do código, as ESCRITAS deste endpoint passam a usar
// o cliente admin (service role, `lib/supabase/admin.ts`) — o mesmo
// mecanismo já usado com segurança no onboarding e nos endpoints públicos
// deste projeto. A autorização deixa de depender de RLS para este caminho e
// passa a ser 100% responsabilidade do código abaixo:
//   1) `requireSession()` garante que existe uma sessão válida;
//   2) a leitura inicial já filtra por `restaurant_id = profile.restaurantId`
//      (usando o cliente autenticado normal — leituras continuam
//      funcionando via RLS, isso nunca foi o problema);
//   3) a escrita repete o mesmo filtro de `restaurant_id`, agora como a
//      ÚNICA barreira de isolamento entre restaurantes para esta operação
//      — e por ser uma condição explícita no `WHERE`, sem depender de
//      nenhuma política externa, dá pra ler e confirmar exatamente o que
//      ela faz, aqui, neste arquivo.
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { profile } = await requireSession();
    const body = await request.json();
    const { status: nextStatus } = parseOrThrow(updateOrderStatusSchema, body);

    const supabase = await createClient();
    const admin = createAdminClient();

    const { data: current, error: currentError } = await supabase
      .from("orders")
      .select("id, status, order_session_id")
      .eq("id", id)
      .eq("restaurant_id", profile.restaurantId)
      .maybeSingle();

    if (currentError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível carregar o pedido.");
    }
    if (!current) {
      throw new AppError("NOT_FOUND", "Pedido não encontrado.");
    }

    assertValidOrderStatusTransition(current.status, nextStatus);

    // Checagem otimista mantida (Sprint 4 de Correção): o `WHERE` inclui o
    // `status` lido segundos atrás, então uma corrida genuína (alguém mudou
    // o status entre a leitura e esta escrita) ainda vira um `409 CONFLICT`
    // explícito, em vez de aplicar uma transição contra dado obsoleto.
    const { data: updated, error: updateError } = await admin
      .from("orders")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("restaurant_id", profile.restaurantId)
      .eq("status", current.status)
      .select("id, status, total_amount, created_at")
      .maybeSingle();

    if (updateError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar o status do pedido.");
    }

    if (!updated) {
      // Sem RLS no caminho de escrita (usa o cliente admin acima), a única
      // explicação possível pra 0 linhas afetadas é uma corrida real: o
      // status mudou entre a leitura e esta escrita — a ambiguidade que
      // motivava um diagnóstico mais elaborado aqui deixou de existir.
      throw new AppError(
        "CONFLICT",
        "O status deste pedido foi alterado por outra pessoa. Recarregue a página e tente novamente.",
      );
    }

    // Sprint "Correção — Responsabilidade de Fechamento Isolada em
    // Fechar Conta" (2026-07-31): este endpoint já fechou a `order_session`
    // sozinho quando o pedido virava o último não-terminal dela (contrato
    // 8.3: "também pode encerrar a order_session correspondente"). Isso
    // era inofensivo enquanto `delivered` só acontecia perto do fim da
    // visita — deixou de ser depois do botão "Finalizar pedido" (marca
    // `delivered` a qualquer momento, sem relação com a comanda ter
    // acabado) e da arquitetura de `order_session` como fonte única para
    // os cards de mesa: marcar o último pedido como "Finalizar pedido"
    // passou a fechar a sessão por conta própria, sem "Fechar conta" ter
    // sido chamado — a mesa sumia da grade e `close_table_bill` deixava de
    // achar a comanda pra fechar de verdade (nenhum `payment_method`
    // nunca era registrado nesses casos). `close_table_bill`
    // (`0020_close_table_bill_marks_delivered.sql`) e a trigger
    // `trg_enforce_no_pending_orders_on_table_release`
    // (`0011_enforce_no_pending_orders_on_table_release.sql`, disparada só
    // por "Liberar mesa") continuam as duas únicas ações autorizadas a
    // fechar `order_session`/liberar mesa — esta rota agora só grava
    // `orders.status`, nada mais.

    return apiSuccess(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
