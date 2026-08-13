import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";

interface RouteParams {
  params: Promise<{ id: string; itemId: string }>;
}

interface CancelOrderItemResult {
  order_id: string;
  order_status: string;
  order_total_amount: number;
  table_released: boolean;
}

// POST /api/v1/orders/{id}/items/{itemId}/cancel
//
// Cancela 1 item específico dentro de um pedido — não o pedido inteiro
// (já existia via PATCH /api/v1/orders/{id}/status). Toda a regra de
// negócio (recalcular o total do pedido, decidir se o pedido inteiro
// vira `cancelled`, decidir se a mesa libera sozinha olhando TODOS os
// pedidos dela) vive na RPC `cancel_order_item` (migration 0034),
// executada como uma transação atômica só — evita qualquer estado
// inconsistente no meio do caminho (ex.: total recalculado mas mesa não
// verificada ainda).
//
// `id` (o pedido) não é usado pela RPC — o item já sabe a qual pedido
// pertence — mas continua na URL por consistência REST com o resto do
// contrato (`orders/{id}/status`, mesmo padrão de aninhamento).
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { itemId } = await params;
    const { profile } = await requireSession();

    const admin = createAdminClient();

    const { data, error } = await admin
      .rpc("cancel_order_item", {
        p_order_item_id: itemId,
        p_restaurant_id: profile.restaurantId,
      })
      .returns<CancelOrderItemResult[]>()
      .maybeSingle();

    if (error) {
      // P0001 = "item não encontrado" (raise exception dentro da própria
      // function) — cobre tanto "não existe" quanto "é de outro
      // restaurante" com a mesma resposta, mesmo padrão de
      // orders/[id]/route.ts (não revelar que o recurso existe).
      if (error.code === "P0001") {
        throw new AppError("NOT_FOUND", "Item não encontrado.");
      }
      throw new AppError("INTERNAL_ERROR", "Não foi possível cancelar o item. Tente novamente.");
    }

    if (!data) {
      throw new AppError("NOT_FOUND", "Item não encontrado.");
    }

    return apiSuccess({
      orderId: data.order_id,
      orderStatus: data.order_status,
      orderTotalAmount: data.order_total_amount,
      tableReleased: data.table_released,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
