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
 * fato não tinha mais. Agora as duas escritas (+ as mesmas validações de
 * sempre: sessão existe, nenhum pedido da sessão ainda não-terminal)
 * vivem dentro de `close_table_bill` (`0019_atomic_close_table_bill.sql`),
 * uma função `security definer` chamada via `.rpc()` — uma única
 * transação, ou tudo acontece ou nada acontece. Contrato da rota
 * (payload, respostas, mensagens de erro) não mudou.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { profile } = await requireSession();
    const body = await request.json();
    const { payment_method } = parseOrThrow(closeBillSchema, body);

    const admin = createAdminClient();

    const { data, error } = await admin
      .rpc("close_table_bill", {
        p_restaurant_id: profile.restaurantId,
        p_table_id: id,
        p_payment_method: payment_method,
      })
      .returns<CloseTableBillResult[]>()
      .maybeSingle();

    if (error) {
      // Mesmas duas validações de sempre, agora levantadas de dentro da
      // função (códigos de erro customizados definidos nela).
      if (error.code === "P0001") {
        throw new AppError("NOT_FOUND", "Esta mesa não tem uma comanda aberta para fechar.");
      }
      if (error.code === "P0002") {
        throw new AppError(
          "CONFLICT",
          "Ainda há pedidos em aberto nesta mesa. Finalize-os antes de fechar a conta.",
        );
      }
      throw new AppError("INTERNAL_ERROR", "Não foi possível fechar a conta. Tente novamente.");
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
    return handleRouteError(err);
  }
}
