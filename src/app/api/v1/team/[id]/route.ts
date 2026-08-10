import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/api/auth";
import { apiNoContent } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/v1/team/{id} — Fase 3, Gestão de Equipe (2026-08-09,
 * encerramento). Remove um funcionário do restaurante do owner autenticado.
 *
 * `profiles.id references auth.users (id) on delete cascade`
 * (`0001_initial_schema.sql`, confirmado antes de implementar isto) — ou
 * seja, apagar o usuário via `admin.auth.admin.deleteUser()` já remove a
 * linha de `profiles` junto, automaticamente, numa operação só. Diferente
 * da criação (`POST`, que precisa de compensação manual porque são duas
 * escritas separadas), aqui não existe risco de "meio criado, meio não" —
 * ou os dois somem juntos, ou nada muda.
 *
 * Segurança/multi-tenancy (mesmo padrão da criação): busca o profile alvo
 * primeiro, pelo cliente admin, e confirma `restaurant_id` igual ao do
 * owner autenticado ANTES de apagar qualquer coisa. Um owner nunca
 * consegue apagar staff de outro restaurante — nem por engano, nem
 * forçando a URL — porque o `id` da rota nunca é usado sozinho, sempre em
 * conjunto com essa checagem. Se não encontrar (`id` errado ou de outro
 * restaurante), devolve `404` — nunca `403` — para não confirmar a
 * existência de um `id` de outro restaurante (mesmo raciocínio já usado em
 * `resolveRestaurantBySlug`).
 *
 * Também nunca permite apagar um `owner` por aqui — só `role = 'staff'`.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { profile } = await requireOwner();
    const admin = createAdminClient();

    const { data: targetProfile, error: fetchError } = await admin
      .from("profiles")
      .select("id, restaurant_id, role")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível remover o funcionário.");
    }
    if (!targetProfile || targetProfile.restaurant_id !== profile.restaurantId) {
      throw new AppError("NOT_FOUND", "Funcionário não encontrado.");
    }
    if (targetProfile.role !== "staff") {
      throw new AppError("FORBIDDEN", "Não é possível remover o proprietário do restaurante.");
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(id);
    if (deleteError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível remover o funcionário.");
    }

    return apiNoContent();
  } catch (err) {
    return handleRouteError(err);
  }
}
