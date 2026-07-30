import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { closeBillSchema } from "@/lib/validations/tables";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Forma da linha que `close_table_bill` devolve — espelha exatamente a
// cláusula `returns table (...)` da função em
// `0019_atomic_close_table_bill.sql`. Sem os tipos gerados de verdade do
// Supabase (`Database` ainda é um placeholder `any` neste ambiente de dev,
// `src/types/database.types.ts`), `.rpc()` não tem como descobrir sozinho
// o formato de retorno de uma função — por isso a chamada abaixo usa
// `.returns<CloseTableBillResult[]>()`, a própria API do supabase-js pra
// declarar o tipo esperado de uma consulta sem precisar de `any`/cast.
interface CloseTableBillResult {
  table_id: string;
  table_name: string;
  table_status: string;
  table_qr_token: string;
}

/**
 * PATCH /api/v1/tables/{id}/close-bill — Sprint "Fechamento de Conta com
 * Registro de Venda" (2026-07-29).
 *
 * Novo passo entre "Fechar conta" e liberar a mesa: antes, `TableDrawer`
 * marcava cada pedido aberto como `delivered` e já liberava a mesa direto
 * (nenhum registro de pagamento, nenhuma sessão fechada). Esta rota é
 * chamada depois desse mesmo laço (inalterado — continua usando
 * `PATCH /api/v1/orders/{id}/status`, o endpoint estável de sempre) e faz
 * só a parte nova: fecha a `order_session` da mesa com a forma de
 * pagamento escolhida e só então libera a mesa.
 *
 * "Registro de venda": não foi criada nenhuma tabela nova. Uma
 * `order_session` fechada (`closed_at` preenchido) já é o registro — os
 * `orders`/`order_items` vinculados a ela nunca são apagados, então
 * histórico de vendas/fechamento de caixa/relatórios futuros são só uma
 * consulta em `order_sessions` (+ soma de `orders.total_amount` por
 * `order_session_id`), sem precisar de mais nada agora.
 *
 * Sprint "Correção — Fechamento de Conta Não-Atômico" (2026-07-30,
 * seguinte): fechar a sessão e liberar a mesa eram duas escritas
 * separadas (duas transações independentes) — se a segunda falhasse (a
 * trigger `trg_enforce_no_pending_orders_on_table_release`,
 * `0011_enforce_no_pending_orders_on_table_release.sql`, é a suspeita
 * concreta), a comanda ficava fechada pra sempre e a mesa presa em
 * "ocupada", sem nenhuma tentativa seguinte conseguir corrigir sozinha —
 * a próxima chamada só encontrava "nenhuma comanda aberta", porque de
 * fato não tinha mais. As duas escritas passaram a viver dentro de
 * `close_table_bill`, uma função `security definer` chamada via `.rpc()`
 * — uma única transação, ou tudo acontece ou nada acontece.
 *
 * Sprint "Refatoração — Backend Assume Marcação de Entregue" (2026-07-30,
 * seguinte): a versão anterior de `close_table_bill` ainda *recusava* o
 * fechamento se sobrasse pedido não-terminal na sessão (`P0002`) —
 * empurrando pro chamador a responsabilidade de já ter marcado tudo como
 * `delivered` antes de chamar aqui. Só que quem fazia essa marcação
 * (`handleConfirmPayment`, `table-drawer.tsx`) decidia quais pedidos
 * marcar a partir de `openOrders`, estado de interface que podia estar
 * desatualizado — daí o fechamento continuar falhando mesmo depois da
 * correção de atomicidade. Agora `close_table_bill`
 * (`0020_close_table_bill_marks_delivered.sql`) busca os pedidos reais da
 * sessão direto no banco e marca como `delivered` qualquer um ainda
 * não-terminal, na mesma transação — o frontend só pede o fechamento,
 * nenhuma decisão de quais registros mudam depende mais de cache de
 * interface. O código de erro `P0002` deixou de existir (nada mais rejeita
 * por "pedido em aberto" — o próprio fechamento resolve isso).
 *
 * ⚠️ DIAGNÓSTICO TEMPORÁRIO (2026-07-30): depois da migration 0020, o erro
 * mudou de mensagem ("Não foi possível fechar a conta. Tente novamente."
 * em vez de "sem comanda aberta") — causa real ainda não identificada.
 * Esta rota está, temporariamente, (1) logando payload recebido + retorno
 * bruto da RPC (`code`/`message`/`details`/`hint`) via `console.error`, e
 * (2) devolvendo o erro completo do Postgres na resposta em vez da
 * mensagem genérica, pra dar pra ver direto no app sem acesso a log de
 * servidor. Tudo marcado com "DIAGNÓSTICO TEMPORÁRIO"/`[DEBUG]` — reverter
 * assim que a causa real for encontrada.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { profile } = await requireSession();
    const body = await request.json();
    const { payment_method } = parseOrThrow(closeBillSchema, body);

    // ─── DIAGNÓSTICO TEMPORÁRIO (remover depois de identificar a causa) ───
    // Payload recebido, antes de qualquer chamada ao banco.
    console.error("[close-bill][DEBUG] payload recebido", {
      table_id: id,
      restaurant_id: profile.restaurantId,
      payment_method,
    });

    const admin = createAdminClient();

    const { data, error } = await admin
      .rpc("close_table_bill", {
        p_restaurant_id: profile.restaurantId,
        p_table_id: id,
        p_payment_method: payment_method,
      })
      .returns<CloseTableBillResult[]>()
      .maybeSingle();

    // ─── DIAGNÓSTICO TEMPORÁRIO (remover depois de identificar a causa) ───
    // Resultado bruto da RPC — `error` do postgrest-js já inclui
    // `code` (SQLSTATE, quando a origem é o Postgres), `message`,
    // `details` e `hint` quando existirem. `new Error().stack` captura o
    // ponto exato desta chamada no código (a exceção do banco em si não
    // tem stack trace de JS, só o `code`/`message`/`details`/`hint`).
    console.error("[close-bill][DEBUG] resultado da RPC", {
      data,
      error: error
        ? {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          }
        : null,
      stack: new Error("[close-bill][DEBUG] stack no ponto da chamada RPC").stack,
    });

    if (error) {
      // A única validação que ainda pode recusar o fechamento: a sessão
      // aberta não existe (levantada de dentro da função, código de erro
      // customizado). Não existe mais rejeição por "pedido em aberto" — a
      // própria função marca os pendentes como entregues antes de fechar.
      if (error.code === "P0001") {
        throw new AppError("NOT_FOUND", "Esta mesa não tem uma comanda aberta para fechar.");
      }
      // ─── DIAGNÓSTICO TEMPORÁRIO (remover depois de identificar a causa) ───
      // Em vez da mensagem genérica, devolve o erro completo do Postgres
      // pra investigação — REVERTER para "Não foi possível fechar a
      // conta. Tente novamente." assim que a causa real for encontrada.
      throw new AppError(
        "INTERNAL_ERROR",
        `[DEBUG] SQLSTATE=${error.code ?? "?"} | ${error.message}${error.details ? ` | details: ${error.details}` : ""}${error.hint ? ` | hint: ${error.hint}` : ""}`,
      );
    }
    if (!data) {
      throw new AppError("NOT_FOUND", "Mesa não encontrada.");
    }

    return apiSuccess({
      id: data.table_id,
      name: data.table_name,
      status: data.table_status,
      qr_token: data.table_qr_token,
    });
  } catch (err) {
    // ─── DIAGNÓSTICO TEMPORÁRIO (remover depois de identificar a causa) ───
    console.error("[close-bill][DEBUG] exceção capturada no catch externo", {
      err,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return handleRouteError(err);
  }
}
