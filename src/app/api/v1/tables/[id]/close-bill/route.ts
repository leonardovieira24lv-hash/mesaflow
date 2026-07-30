import { createClient } from "@/lib/supabase/server";
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

// Forma da linha que a consulta do novo GET devolve — mesmo raciocínio de
// `CloseTableBillResult` acima: sem os tipos gerados do Supabase,
// declaramos a forma esperada explicitamente em vez de deixar `any`
// vazar, tipando a variável desestruturada em vez de usar cast.
interface OpenSessionOrderRow {
  id: string;
  status: string;
  order_items: { name: string; quantity: number; price: number }[];
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
 * ⚠️ DIAGNÓSTICO TEMPORÁRIO (2026-07-30, seguinte): mesmo depois da rota
 * acima existir, o modal continuou reportando comanda vazia. Este `GET`
 * está, temporariamente, logando (`console.error`, tag `[DEBUG]`): o
 * `session.id` encontrado logo após a 1ª consulta; para cada pedido
 * devolvido pela 2ª consulta (`order_session_id = session.id`), o
 * `order.id` e a contagem de itens; e, se a 2ª consulta não devolver
 * nenhum pedido, uma 3ª consulta extra (só pedidos por `table_id`, sem
 * filtro de sessão) pra comparar `order_session_id` real desses pedidos
 * contra o `session.id` esperado. Também loga o objeto bruto e completo
 * (via `JSON.stringify`) do primeiro pedido retornado, antes de qualquer
 * `.map()`/transformação — pra distinguir "dado não veio do banco" de
 * "dado veio, mas se perde na transformação". Reverter assim que a causa
 * for encontrada.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { profile } = await requireSession();

    const supabase = await createClient();

    // Mesmo critério de `close_table_bill` para "qual é a comanda desta
    // mesa": a `order_session` aberta — não o status dos pedidos.
    const { data: session, error: sessionError } = await supabase
      .from("order_sessions")
      .select("id, opened_at")
      .eq("table_id", id)
      .eq("restaurant_id", profile.restaurantId)
      .is("closed_at", null)
      .maybeSingle();

    if (sessionError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível carregar a comanda desta mesa.");
    }
    if (!session) {
      throw new AppError("NOT_FOUND", "Esta mesa não tem uma comanda aberta para fechar.");
    }

    // ─── DIAGNÓSTICO TEMPORÁRIO (remover depois de identificar a causa) ───
    console.error("[close-bill][GET][DEBUG] session.id encontrado", {
      table_id: id,
      session_id: session.id,
      opened_at: session.opened_at,
    });

    // Todos os pedidos da sessão, sem filtro de status — um pedido já
    // `delivered` continua fazendo parte da comanda que está sendo fechada.
    const {
      data: orders,
      error: ordersError,
    }: { data: OpenSessionOrderRow[] | null; error: unknown } = await supabase
      .from("orders")
      .select("id, status, order_items(name, quantity, price)")
      .eq("order_session_id", session.id);

    if (ordersError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível carregar os pedidos desta comanda.");
    }

    // ─── DIAGNÓSTICO TEMPORÁRIO (remover depois de identificar a causa) ───
    console.error("[close-bill][GET][DEBUG] pedidos retornados pela consulta por order_session_id", {
      session_id: session.id,
      count: orders?.length ?? 0,
      orders: (orders ?? []).map((o) => ({
        order_id: o.id,
        order_session_id: session.id, // a própria condição do WHERE — incluído aqui só pra facilitar comparação visual na mesma linha
        item_count: o.order_items?.length ?? 0,
      })),
    });

    // ─── DIAGNÓSTICO TEMPORÁRIO (remover depois de identificar a causa) ───
    // Objeto COMPLETO do primeiro pedido, exatamente como veio do
    // Supabase — antes de qualquer `.map()`/transformação. Se
    // `order_items` já vier vazio ou ausente aqui, o problema é na
    // consulta/join; se vier preenchido aqui mas some depois, o problema
    // é na transformação (`.map()` mais abaixo ou no componente).
    console.error(
      "[close-bill][GET][DEBUG] objeto bruto do primeiro pedido (JSON.stringify completo)",
      JSON.stringify(orders?.[0] ?? null, null, 2),
    );

    // ─── DIAGNÓSTICO TEMPORÁRIO (remover depois de identificar a causa) ───
    // Se a consulta por order_session_id não trouxe nada, busca TODOS os
    // pedidos da mesa (sem filtro de sessão) pra comparar: o que essa
    // segunda consulta mostrar em `order_session_id` é o valor real que os
    // pedidos têm — pode ser outra sessão, ou `null`.
    if (!orders || orders.length === 0) {
      const { data: allTableOrders, error: allTableOrdersError } = await supabase
        .from("orders")
        .select("id, order_session_id, table_id, status")
        .eq("table_id", id);

      console.error("[close-bill][GET][DEBUG] nenhum pedido encontrado por order_session_id — comparação com todos os pedidos da mesa", {
        table_id: id,
        session_id_esperado: session.id,
        error: allTableOrdersError ? allTableOrdersError.message : null,
        orders: allTableOrders,
      });
    }

    return apiSuccess({
      session_id: session.id,
      opened_at: session.opened_at,
      orders: (orders ?? []).map((order) => ({
        id: order.id,
        status: order.status,
        items: order.order_items,
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
