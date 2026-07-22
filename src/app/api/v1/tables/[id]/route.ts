import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess, apiNoContent } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { updateTableSchema } from "@/lib/validations/tables";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/v1/tables/{id} — contrato seção 7.3
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { profile } = await requireSession();
    const body = await request.json();
    const { name, status } = parseOrThrow(updateTableSchema, body);

    const supabase = await createClient();

    const updates: { name?: string; status?: string } = {};
    if (name !== undefined) updates.name = name;
    if (status !== undefined) updates.status = status;

    const { data: updated, error } = await supabase
      .from("tables")
      .update(updates)
      .eq("id", id)
      .eq("restaurant_id", profile.restaurantId)
      .select("id, name, status, qr_token")
      .maybeSingle();

    if (error) {
      // 23505 = unique_violation (restaurant_id, name).
      if (error.code === "23505") {
        throw new AppError("CONFLICT", "Já existe uma mesa com esse nome.");
      }
      throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar a mesa. Tente novamente.");
    }

    // RLS + o filtro por restaurant_id garantem que uma mesa de outro
    // restaurante nunca aparece aqui — o resultado nulo cobre tanto "não
    // existe" quanto "não é sua" com a mesma resposta (mesmo padrão de
    // `menu/categories/[id]/route.ts`, seção 5.3).
    if (!updated) {
      throw new AppError("NOT_FOUND", "Mesa não encontrada.");
    }

    return apiSuccess({
      id: updated.id,
      name: updated.name,
      status: updated.status,
      qr_token: updated.qr_token,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE /api/v1/tables/{id} — contrato seção 7.4
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { profile } = await requireSession();

    const supabase = await createClient();

    // Contrato 7.4: "não pode excluir mesa com order_session em aberto"
    // (retorna 409). `order_sessions.table_id` é `on delete cascade`
    // (migration 0001) — não `restrict` como no Cardápio (5.4/6.5) — então
    // o banco nunca bloquearia isso sozinho; a checagem precisa ser feita
    // aqui, antes do delete. Depende da política de select adicionada em
    // `0006_tables_management_policies.sql`.
    const { data: openSession, error: sessionError } = await supabase
      .from("order_sessions")
      .select("id")
      .eq("table_id", id)
      .eq("restaurant_id", profile.restaurantId)
      .is("closed_at", null)
      .limit(1)
      .maybeSingle();

    if (sessionError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível verificar o status da mesa.");
    }

    if (openSession) {
      throw new AppError(
        "CONFLICT",
        "Esta mesa tem uma comanda em aberto. Feche a comanda antes de excluir a mesa.",
      );
    }

    const { data: deleted, error } = await supabase
      .from("tables")
      .delete()
      .eq("id", id)
      .eq("restaurant_id", profile.restaurantId)
      .select("id")
      .maybeSingle();

    if (error) {
      // 23503 = foreign_key_violation — rede de segurança caso alguma outra
      // referência (ex.: `orders.table_id`, `on delete restrict`) impeça a
      // exclusão além do caso já coberto pela checagem de `order_session`
      // acima.
      if (error.code === "23503") {
        throw new AppError(
          "CONFLICT",
          "Esta mesa possui pedidos vinculados e não pode ser excluída.",
        );
      }
      throw new AppError("INTERNAL_ERROR", "Não foi possível excluir a mesa. Tente novamente.");
    }

    if (!deleted) {
      throw new AppError("NOT_FOUND", "Mesa não encontrada.");
    }

    return apiNoContent();
  } catch (err) {
    return handleRouteError(err);
  }
}
