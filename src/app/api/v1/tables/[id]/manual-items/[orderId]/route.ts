import { requireSession } from "@/lib/api/auth";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { apiSuccess } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string; orderId: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id: tableId, orderId } = await params;
    const { profile } = await requireSession();
    const admin = createAdminClient();

    const { data, error } = await admin.rpc("cancel_manual_table_item", {
      p_restaurant_id: profile.restaurantId,
      p_table_id: tableId,
      p_order_id: orderId,
    });

    if (error) {
      if (error.message.includes("MANUAL_ITEM_NOT_FOUND")) {
        throw new AppError("NOT_FOUND", "Lançamento avulso não encontrado.");
      }
      throw new AppError("INTERNAL_ERROR", "Não foi possível cancelar o item avulso.");
    }

    const cancelled = Array.isArray(data) ? data[0] : data;
    if (!cancelled) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível cancelar o item avulso.");
    }

    return apiSuccess({
      order_id: cancelled.order_id as string,
      tableReleased: Boolean(cancelled.table_released),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
