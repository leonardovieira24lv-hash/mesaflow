import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { closeBillSchema } from "@/lib/validations/tables";
import { getOpenOrderSessions, getOrdersForSessions } from "@/lib/tables/get-open-table-operations";

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
 * Sprint "Correção — SQLSTATE 42702" (2026-07-30, seguinte): depois da
 * migration 0020, `close_table_bill` passou a falhar com
 * "column reference 'table_id' is ambiguous" — os nomes da cláusula
 * `returns table (table_id, ...)` viram variáveis automáticas no escopo
 * da função em PL/pgSQL, colidindo com a coluna `order_sessions.table_id`
 * referenciada sem alias. Corrigido em `0021_fix_ambiguous_column_close_table_bill.sql`
 * (todas as tabelas/colunas da função qualificadas com alias). A
 * instrumentação temporária usada para achar essa causa (log de
 * payload/RPC + erro completo do Postgres na resposta) foi revertida
 * junto — voltou a devolver só a mensagem genérica de sempre.
 *
 * Sprint "Correção — Fonte Única de Verdade no Carregamento do Modal"
 * (2026-07-30, seguinte): `<CloseBillModal>` buscava os pedidos da mesa
 * via `GET /api/v1/orders?status=pending,preparing,ready`, filtrando por
 * STATUS. Isso diverge de como `close_table_bill` decide o que pertence à
 * comanda (pela `order_session` aberta, `order_session_id`, sem olhar
 * status) — um pedido legitimamente já `delivered` (ex.: garçom já marcou
 * "entregue" na tela de Pedidos, bem antes de "Fechar conta" ser clicado)
 * é ignorado pela consulta antiga, mesmo continuando parte da comanda.
 * O `GET` novo abaixo usa exatamente o mesmo critério da função: localiza
 * a `order_session` aberta da mesa e devolve TODOS os pedidos vinculados a
 * ela, de qualquer status — a mesma fonte de verdade dos dois lados.
 * Somente leitura, nenhuma escrita — `PATCH` abaixo continua idêntico.
 *
 * Diagnóstico anterior (2026-07-30, mesmo dia): a causa raiz de "comanda
 * vazia" era uma policy de RLS não-correlacionada em `order_items`
 * (corrigida na migration 0022) — a instrumentação temporária usada para
 * achar isso já foi removida, confirmada a correção.
 *
 * Sprint "Fonte Única de Verdade — order_session" (2026-07-30, seguinte):
 * as duas consultas deste `GET` (achar a sessão aberta, buscar os pedidos
 * dela) foram extraídas para `lib/tables/get-open-table-operations.ts` —
 * o Painel de Mesas (`GET /api/v1/tables/operations`) precisava do mesmo
 * critério "comanda = sessão aberta" para o restaurante inteiro, e manter
 * duas cópias da mesma regra de negócio era exatamente o tipo de
 * divergência futura que motivou esta extração. Nenhuma mudança de
 * comportamento aqui — mesmas duas consultas, mesmo formato de resposta.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { profile } = await requireSession();

    const supabase = await createClient();

    const [session] = await getOpenOrderSessions(supabase, profile.restaurantId, id);

    if (!session) {
      throw new AppError("NOT_FOUND", "Esta mesa não tem uma comanda aberta para fechar.");
    }

    const orders = await getOrdersForSessions(supabase, [session.id]);

    return apiSuccess({
      session_id: session.id,
      opened_at: session.openedAt,
      orders: orders.map((order) => ({
        id: order.id,
        status: order.status,
        items: order.items,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
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
 * seguinte): `close_table_bill` (`0020_close_table_bill_marks_delivered.sql`)
 * busca os pedidos reais da sessão direto no banco e marca como
 * `delivered` qualquer um ainda não-terminal, na mesma transação — o
 * frontend só pede o fechamento, nenhuma decisão de quais registros
 * mudam depende de cache de interface.
 *
 * Sprint "Correção — SQLSTATE 42702" (2026-07-30, seguinte): corrigida
 * ambiguidade de coluna em `0021_fix_ambiguous_column_close_table_bill.sql`
 * (ver docstring do `GET` acima para o histórico completo).
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
      // A única validação que ainda pode recusar o fechamento: a sessão
      // aberta não existe (levantada de dentro da função, código de erro
      // customizado). Não existe mais rejeição por "pedido em aberto" — a
      // própria função marca os pendentes como entregues antes de fechar.
      if (error.code === "P0001") {
        throw new AppError("NOT_FOUND", "Esta mesa não tem uma comanda aberta para fechar.");
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
