import { requireSession } from "@/lib/api/auth";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { apiCreated } from "@/lib/api/response";
import { parseOrThrow } from "@/lib/api/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createManualTableItemSchema } from "@/lib/validations/manual-table-item";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: tableId } = await params;
    const { profile } = await requireSession();
    const input = parseOrThrow(createManualTableItemSchema, await request.json());
    const admin = createAdminClient();

    const { data, error } = await admin.rpc("add_manual_table_item", {
      p_restaurant_id: profile.restaurantId,
      p_table_id: tableId,
      p_name: input.name,
      p_amount: input.amount,
      p_quantity: input.quantity,
      p_notes: input.notes ?? null,
    });

    if (error) {
      if (error.message.includes("TABLE_NOT_FOUND")) {
        throw new AppError("NOT_FOUND", "Mesa não encontrada.");
      }
      if (error.message.includes("TABLE_MAINTENANCE")) {
        throw new AppError("CONFLICT", "Não é possível lançar item em uma mesa em manutenção.");
      }
      throw new AppError("INTERNAL_ERROR", "Não foi possível adicionar o item avulso.");
    }

    const created = Array.isArray(data) ? data[0] : data;
    if (!created) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível adicionar o item avulso.");
    }

    return apiCreated({
      order_id: created.order_id as string,
      order_session_id: created.order_session_id as string,
      total_amount: Number(created.total_amount),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
