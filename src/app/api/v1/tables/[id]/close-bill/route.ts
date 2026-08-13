import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { closeBillSchema, resolveAcceptedPaymentMethods } from "@/lib/validations/tables";
import { getOpenOrderSessions, getOrdersForSessions } from "@/lib/tables/get-open-table-operations";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Forma devolvida pelo GET — mesmo formato que `CloseBillModal` já espera
// (`OpenSessionResponse`, `components/mesas/close-bill-modal.tsx`).
interface OpenSessionResponse {
  session_id: string;
  opened_at: string;
  orders: {
    id: string;
    status: string;
    items: { name: string; quantity: number; price: number; cancelled_at: string | null }[];
  }[];
}

/**
 * GET /api/v1/tables/{id}/close-bill — dados da comanda aberta desta mesa,
 * pra popular o modal "Fechar conta" antes da confirmação.
 *
 * Reaproveita `getOpenOrderSessions`/`getOrdersForSessions`
 * (`lib/tables/get-open-table-operations.ts`) — a mesma fonte única de
 * verdade que o Painel de Mesas usa pra decidir "o que é uma comanda
 * ativa": pela `order_session` aberta da mesa, nunca pelo status dos
 * pedidos. Um pedido já `delivered` (garçom marcou entregue antes de
 * "Fechar conta" ser clicado — fluxo normal) continua fazendo parte da
 * comanda sendo fechada.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: tableId } = await params;
    const { profile } = await requireSession();
    const supabase = await createClient();

    const sessions = await getOpenOrderSessions(supabase, profile.restaurantId, tableId);
    const session = sessions[0];

    if (!session) {
      throw new AppError("NOT_FOUND", "Esta mesa não tem uma comanda aberta para fechar.");
    }

    const orders = await getOrdersForSessions(supabase, [session.id]);

    const response: OpenSessionResponse = {
      session_id: session.id,
      opened_at: session.openedAt,
      orders: orders.map((order) => ({
        id: order.id,
        status: order.status,
        items: order.items,
      })),
    };

    return apiSuccess(response);
  } catch (err) {
    return handleRouteError(err);
  }
}

// Forma da linha que `close_table_bill` devolve — espelha a cláusula
// `returns table (...)` de `0020_close_table_bill_marks_delivered.sql`.
interface CloseTableBillResult {
  table_id: string;
  table_name: string;
  table_status: string;
  table_qr_token: string;
}

/**
 * PATCH /api/v1/tables/{id}/close-bill — fecha a comanda da mesa com a
 * forma de pagamento escolhida. Endpoint fino: toda a regra de negócio
 * (marcar pedidos como `delivered`, fechar a sessão, liberar a mesa — tudo
 * numa transação só) vive em `close_table_bill`
 * (`security definer`, `0020_close_table_bill_marks_delivered.sql`).
 * `restaurantId`/`tableId` nunca vêm do body — sempre de `requireSession()`
 * (sessão autenticada) e dos parâmetros da própria rota.
 *
 * Fase 4B.1 — Pagamentos em Mesas (2026-08-10): segunda camada de
 * validação, além do filtro visual em `close-bill-modal.tsx` — confirma
 * que `payment_method` está entre as formas atualmente aceitas do
 * restaurante (`restaurants.accepted_payment_methods`, já normalizado por
 * `resolveAcceptedPaymentMethods`, mesmo fallback defensivo de sempre: se
 * a configuração vier nula/vazia/inconsistente, cai nas 4 formas padrão em
 * vez de bloquear o fechamento por causa disso). `restaurant_id` usado
 * nesta consulta é sempre `profile.restaurantId`, nunca algo vindo do
 * cliente — um restaurante nunca valida contra a configuração de outro.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id: tableId } = await params;
    const { profile } = await requireSession();
    const body = await request.json();
    const { payment_method } = parseOrThrow(closeBillSchema, body);

    const supabase = await createClient();
    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("accepted_payment_methods")
      .eq("id", profile.restaurantId)
      .single();

    if (restaurantError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível confirmar a forma de pagamento.");
    }

    const acceptedMethods = resolveAcceptedPaymentMethods(restaurant?.accepted_payment_methods);
    if (!acceptedMethods.includes(payment_method)) {
      throw new AppError("VALIDATION_ERROR", "Esta forma de pagamento não está mais disponível para este restaurante.");
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .rpc("close_table_bill", {
        p_restaurant_id: profile.restaurantId,
        p_table_id: tableId,
        p_payment_method: payment_method,
      })
      .returns<CloseTableBillResult[]>()
      .maybeSingle();

    if (error) {
      // P0001 = "esta mesa não tem uma comanda aberta para fechar" (raise
      // exception dentro da própria function) — mensagem já pronta pro
      // usuário final, só repassa.
      if (error.code === "P0001") {
        throw new AppError("CONFLICT", error.message);
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
      qrToken: data.table_qr_token,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
