import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { updateOrderStatusSchema } from "@/lib/validations/orders";
import { assertValidOrderStatusTransition, TERMINAL_ORDER_STATUSES } from "@/lib/orders/status-transitions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/v1/orders/{id}/status — contrato seção 8.3
//
// Cobre tanto o avanço normal de status quanto o cancelamento (mesmo
// endpoint, valor diferente de `status` — evita endpoint duplicado só para
// cancelamento, conforme o contrato).
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { profile } = await requireSession();
    const body = await request.json();
    const { status: nextStatus } = parseOrThrow(updateOrderStatusSchema, body);

    const supabase = await createClient();

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

    // Sprint 4 de Correção (Fase de Estabilização) — bug da auditoria: o
    // UPDATE abaixo não checava se `status` continuava sendo o mesmo lido
    // em `current` alguns instantes atrás. Duas pessoas mudando o status do
    // mesmo pedido quase ao mesmo tempo (ex.: uma marca "pronto", outra
    // cancela) podiam ambas passar pela validação de transição (as duas
    // leram o mesmo `current.status` antes de qualquer uma escrever) e o
    // resultado final era só o que "ganhasse a corrida" no UPDATE — a outra
    // mudança, já confirmada como sucesso para quem clicou, desaparecia
    // silenciosamente. Adicionar `current.status` ao filtro do UPDATE torna
    // isso uma checagem otimista: se o status já não for mais o esperado, o
    // UPDATE não afeta nenhuma linha e a resposta vira um conflito explícito
    // em vez de aplicar uma transição validada contra dado obsoleto.
    //
    // Sem trigger de `updated_at` no banco (migration 0001 só define o
    // default na criação) — mesmo padrão manual já usado em
    // `tables/qr-codes/print-confirmation/route.ts` (seção 7.5).
    const { data: updated, error: updateError } = await supabase
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
      // O pedido existia (já confirmado acima); se não veio nenhuma linha
      // agora, é porque o status mudou entre a leitura e esta escrita.
      throw new AppError(
        "CONFLICT",
        "O status deste pedido foi alterado por outra pessoa. Recarregue a página e tente novamente.",
      );
    }

    // Contrato 8.3: "se o novo status for terminal, também pode encerrar a
    // order_session correspondente". Só encerra se este for o ÚLTIMO pedido
    // não-terminal daquela sessão — uma mesa pode ter vários pedidos na
    // mesma visita (contrato 3.1: "active_order"), então um pedido chegar a
    // `delivered` não significa necessariamente que a comanda inteira da
    // mesa acabou.
    if (TERMINAL_ORDER_STATUSES.includes(nextStatus) && current.order_session_id) {
      const { count: stillOpenCount, error: stillOpenError } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("order_session_id", current.order_session_id)
        .neq("id", current.id)
        .not("status", "in", "(delivered,cancelled)");

      if (!stillOpenError && (stillOpenCount ?? 0) === 0) {
        const { error: closeSessionError } = await supabase
          .from("order_sessions")
          .update({ closed_at: new Date().toISOString() })
          .eq("id", current.order_session_id)
          .is("closed_at", null);

        if (closeSessionError) {
          // Não falha a resposta por causa disso — o pedido já foi
          // atualizado com sucesso; encerrar a sessão é um efeito colateral
          // best-effort.
          console.error("[orders.status] falha ao encerrar order_session", closeSessionError);
        }
      }
    }

    return apiSuccess(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
