import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { closeBillSchema } from "@/lib/validations/tables";
import { TERMINAL_ORDER_STATUSES } from "@/lib/orders/status-transitions";
import type { OrderStatus } from "@/types/domain";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Forma da linha que a consulta abaixo devolve — `status` é `OrderStatus`
// (não o `string` genérico que a checagem `Database = any` inferiria
// sozinha), o mesmo padrão já usado em `ActiveOrderSummary`
// (`lib/orders/active-order.ts`) e `MenuItemRow` (`lib/orders/create-order.ts`)
// para tipar corretamente o retorno de consultas ao Supabase enquanto os
// tipos gerados de verdade não existem neste ambiente de dev.
interface SessionOrderRow {
  id: string;
  status: OrderStatus;
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
 * Checagem defensiva própria (além do `allReady` que já trava o botão na
 * UI): se sobrar qualquer pedido não-terminal vinculado a esta sessão no
 * momento exato da chamada, rejeita com 409 em vez de registrar uma venda
 * com comanda ainda em aberto — cobre a mesma janela de corrida que outras
 * rotas deste módulo já tratam (ex.: `create-order.ts`).
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { profile } = await requireSession();
    const body = await request.json();
    const { payment_method } = parseOrThrow(closeBillSchema, body);

    const supabase = await createClient();
    const admin = createAdminClient();

    const { data: session, error: sessionError } = await supabase
      .from("order_sessions")
      .select("id")
      .eq("table_id", id)
      .eq("restaurant_id", profile.restaurantId)
      .is("closed_at", null)
      .maybeSingle();

    if (sessionError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível verificar a comanda desta mesa.");
    }
    if (!session) {
      throw new AppError("NOT_FOUND", "Esta mesa não tem uma comanda aberta para fechar.");
    }

    const {
      data: sessionOrders,
      error: ordersError,
    }: { data: SessionOrderRow[] | null; error: unknown } = await supabase
      .from("orders")
      .select("id, status")
      .eq("order_session_id", session.id);

    if (ordersError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível verificar os pedidos desta mesa.");
    }

    const stillOpen = (sessionOrders ?? []).some((order) => !TERMINAL_ORDER_STATUSES.includes(order.status));
    if (stillOpen) {
      throw new AppError(
        "CONFLICT",
        "Ainda há pedidos em aberto nesta mesa. Finalize-os antes de fechar a conta.",
      );
    }

    const { error: closeSessionError } = await admin
      .from("order_sessions")
      .update({ closed_at: new Date().toISOString(), payment_method })
      .eq("id", session.id)
      .eq("restaurant_id", profile.restaurantId);

    if (closeSessionError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o pagamento. Tente novamente.");
    }

    const { data: releasedTable, error: releaseError } = await admin
      .from("tables")
      .update({ status: "livre" })
      .eq("id", id)
      .eq("restaurant_id", profile.restaurantId)
      .select("id, name, status, qr_token")
      .maybeSingle();

    if (releaseError) {
      // O pagamento já foi registrado com sucesso no passo anterior — não
      // desfazemos isso; só avisamos que a liberação da mesa precisa ser
      // manual (mesmo texto de fallback já usado em `handleCloseBill`).
      throw new AppError(
        "INTERNAL_ERROR",
        "Pagamento registrado, mas não foi possível liberar a mesa. Libere manualmente.",
      );
    }
    if (!releasedTable) {
      throw new AppError("NOT_FOUND", "Mesa não encontrada.");
    }

    return apiSuccess({
      id: releasedTable.id,
      name: releasedTable.name,
      status: releasedTable.status,
      qr_token: releasedTable.qr_token,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
