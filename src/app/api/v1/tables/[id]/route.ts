import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess, apiNoContent } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { updateTableSchema } from "@/lib/validations/tables";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/v1/tables/{id} — contrato seção 7.3
//
// Escritas via cliente admin (service role) — mesma mudança arquitetural
// aplicada em `orders/[id]/status/route.ts`: a autorização entre
// restaurantes deixa de depender de RLS (não verificável/corrigível a
// partir daqui, suspeita real após a reconfiguração de ambiente) e passa a
// ser 100% o filtro explícito `.eq("restaurant_id", profile.restaurantId)`
// abaixo, lido e confirmado neste arquivo.
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { profile } = await requireSession();
    const body = await request.json();
    const { name, status } = parseOrThrow(updateTableSchema, body);

    const admin = createAdminClient();

    const updates: { name?: string; status?: string } = {};
    if (name !== undefined) updates.name = name;
    if (status !== undefined) updates.status = status;

    const { data: updated, error } = await admin
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

    // O filtro por restaurant_id acima garante que uma mesa de outro
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
    const admin = createAdminClient();

    // Contrato 7.4: "não pode excluir mesa com order_session em aberto"
    // (retorna 409). `order_sessions.table_id` é `on delete cascade`
    // (migration 0001) — não `restrict` como no Cardápio (5.4/6.5) — então
    // o banco nunca bloquearia isso sozinho; a checagem precisa ser feita
    // aqui, antes do delete. Leitura continua no cliente autenticado — a
    // suspeita de infraestrutura é especificamente sobre escritas, e
    // leituras seguem funcionando normalmente via RLS.
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

    // Exclusão via cliente admin — mesma mudança arquitetural do PATCH
    // acima: o filtro explícito de restaurant_id é a única barreira de
    // isolamento aqui agora, não depende de RLS.
    const { data: deleted, error } = await admin
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
