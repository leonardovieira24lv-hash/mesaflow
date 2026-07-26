import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { updateOrderStatusSchema } from "@/lib/validations/orders";
import { assertValidOrderStatusTransition, TERMINAL_ORDER_STATUSES } from "@/lib/orders/status-transitions";
import type { ApiErrorDetail } from "@/types/api";

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
      // Causa raiz da investigação: este código presumia, sem checar, que
      // "0 linhas afetadas" só podia significar "o status mudou entre a
      // leitura e esta escrita" — e reportava isso como certeza absoluta ao
      // usuário. Mas isso é só UMA hipótese: o UPDATE tem três condições no
      // WHERE (`id`, `restaurant_id`, `status`) mais o que a política de RLS
      // aplica por baixo dos panos (`update_own_orders`, migration 0007) —
      // zero linhas afetadas também acontece se RLS bloquear a escrita por
      // qualquer motivo, mesmo com todos os valores exatamente como esperado.
      //
      // Reconsulta SEM o filtro de `restaurant_id` desta vez, de propósito —
      // deixa só a política de RLS decidir se a linha é visível. Se RLS
      // deixar ler, `recheck.restaurant_id` mostra o valor REAL da linha,
      // pra comparar contra o que foi usado, em vez de simplesmente não
      // encontrar nada por causa do próprio filtro que eu mesmo apliquei.
      const { data: recheck, error: recheckError } = await supabase
        .from("orders")
        .select("id, status, restaurant_id")
        .eq("id", id)
        .maybeSingle();

      const diagnostico = {
        id_usado: id,
        restaurant_id_usado: profile.restaurantId,
        status_esperado: current.status,
        status_encontrado: recheck?.status ?? null,
        restaurant_id_encontrado: recheck?.restaurant_id ?? null,
        linhas_afetadas_pelo_update: 0,
      };

      // Registrado sempre, independente de qual ramo abaixo for tomado —
      // pra aparecer nos logs da função na Vercel mesmo quando o motivo
      // final ficar indeterminado.
      console.error("[orders.status] UPDATE afetou 0 linhas — diagnóstico completo:", diagnostico);

      const detailsBase: ApiErrorDetail[] = [
        { field: "id_usado", issue: diagnostico.id_usado },
        { field: "restaurant_id_usado", issue: diagnostico.restaurant_id_usado },
        { field: "status_esperado", issue: diagnostico.status_esperado },
        { field: "linhas_afetadas_pelo_update", issue: "0" },
      ];

      if (recheckError) {
        // A própria reconsulta falhou — não há dado nenhum pra comparar.
        throw new AppError(
          "INTERNAL_ERROR",
          "Causa indeterminada. UPDATE afetou 0 linhas, porém não foi possível distinguir entre RLS, política de acesso ou outro bloqueio.",
          [...detailsBase, { field: "erro_na_reconsulta", issue: recheckError.message }],
        );
      }

      if (!recheck) {
        // Nem sem o filtro de restaurant_id a linha foi encontrada — RLS
        // está bloqueando até a LEITURA para este usuário; não dá nem pra
        // ver o restaurant_id real da linha a partir daqui.
        throw new AppError(
          "INTERNAL_ERROR",
          "Causa indeterminada. UPDATE afetou 0 linhas, porém não foi possível distinguir entre RLS, política de acesso ou outro bloqueio.",
          [
            ...detailsBase,
            { field: "status_encontrado", issue: "(linha não encontrada nem sem o filtro de restaurant_id)" },
            { field: "restaurant_id_encontrado", issue: "(não determinável — leitura bloqueada)" },
            {
              field: "motivo_final_identificado",
              issue: "reconsulta sem filtro de restaurant_id também não encontrou a linha — bloqueio de leitura, não só de escrita",
            },
          ],
        );
      }

      if (recheck.status !== current.status) {
        // O status genuinamente mudou entre a leitura e a escrita — conflito real, confirmado por dado, não por suposição.
        throw new AppError(
          "CONFLICT",
          "O status deste pedido foi alterado por outra pessoa. Recarregue a página e tente novamente.",
          [
            ...detailsBase,
            { field: "status_encontrado", issue: recheck.status },
            { field: "restaurant_id_encontrado", issue: recheck.restaurant_id },
            { field: "motivo_final_identificado", issue: "status mudou entre a leitura e a escrita — conflito real" },
          ],
        );
      }

      if (recheck.restaurant_id !== profile.restaurantId) {
        // Cenário defensivo: RLS deixou ler a linha (ela pertence a algum
        // restaurante do usuário), mas o `restaurant_id` real dela diverge
        // do usado no filtro original. Não deveria ser possível se a
        // política de SELECT já limita isso — registrado mesmo assim, sem
        // inventar por que aconteceria.
        throw new AppError(
          "INTERNAL_ERROR",
          "Causa indeterminada. UPDATE afetou 0 linhas, porém não foi possível distinguir entre RLS, política de acesso ou outro bloqueio.",
          [
            ...detailsBase,
            { field: "status_encontrado", issue: recheck.status },
            { field: "restaurant_id_encontrado", issue: recheck.restaurant_id },
            {
              field: "motivo_final_identificado",
              issue: "restaurant_id real da linha diverge do usado no filtro, apesar de RLS ter permitido a leitura",
            },
          ],
        );
      }

      // id, restaurant_id e status batem exatamente com o esperado — e
      // ainda assim o UPDATE afetou 0 linhas. Não há dado que explique isso;
      // não invento um culpado. RLS/política de acesso é o candidato mais
      // plausível (é a única checagem que a leitura e a escrita fazem de
      // forma diferente), mas não há como confirmar isso a partir da API —
      // consultar `pg_policies`/logs do Postgres exigiria acesso direto ao
      // banco, fora do alcance deste endpoint.
      throw new AppError(
        "INTERNAL_ERROR",
        "Causa indeterminada. UPDATE afetou 0 linhas, porém não foi possível distinguir entre RLS, política de acesso ou outro bloqueio.",
        [
          ...detailsBase,
          { field: "status_encontrado", issue: recheck.status },
          { field: "restaurant_id_encontrado", issue: recheck.restaurant_id },
          {
            field: "motivo_final_identificado",
            issue: "id, restaurant_id e status batem exatamente com o esperado — bloqueio não explicável pelos dados",
          },
        ],
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
