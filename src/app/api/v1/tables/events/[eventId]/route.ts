import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { updateTableEventStatusSchema } from "@/lib/validations/table-events";

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

// PATCH /api/v1/tables/events/{eventId} — docs/table-events-roadmap.md seção 2
//
// Nota de arquitetura: a especificação original descrevia esta rota como
// `PATCH /api/v1/tables/{tableId}/events/{eventId}`. Implementado aqui sem
// `tableId` no caminho — o `id` do evento já é globalmente único, e
// `restaurant_id` (não `table_id`) já é a fronteira de isolamento real,
// igual a `PATCH /api/v1/orders/{id}/status`, que também não é aninhada sob
// mesa/restaurante. Mantém a API administrativa com uma única convenção de
// URL para "avançar o status de uma coisa": plana, nunca aninhada.
//
// Escritas via cliente admin (service role), mesmo padrão arquitetural já
// adotado em `orders/[id]/status` e `tables/[id]` — elimina a dependência de
// RLS de UPDATE como possível ponto único de falha silenciosa; a leitura
// inicial (abaixo) continua no cliente autenticado normal, e o filtro
// explícito por `restaurant_id` na escrita é a única barreira de isolamento
// entre restaurantes para esta operação.
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const { userId, profile } = await requireSession();
    const body = await request.json();
    const { status: nextStatus } = parseOrThrow(updateTableEventStatusSchema, body);

    const supabase = await createClient();
    const admin = createAdminClient();

    const { data: current, error: currentError } = await supabase
      .from("table_events")
      .select("id, status")
      .eq("id", eventId)
      .eq("restaurant_id", profile.restaurantId)
      .maybeSingle();

    if (currentError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível carregar o evento.");
    }
    if (!current) {
      throw new AppError("NOT_FOUND", "Evento não encontrado.");
    }
    if (current.status === "resolved") {
      throw new AppError("CONFLICT", "Este evento já foi resolvido.");
    }

    // Checagem otimista, mesmo padrão de `orders/[id]/status`: o `WHERE`
    // inclui o status lido segundos atrás, então uma corrida genuína (outro
    // atendente já resolveu este evento) vira um `409 CONFLICT` explícito.
    const { data: updated, error: updateError } = await admin
      .from("table_events")
      .update({
        status: nextStatus,
        ...(nextStatus === "resolved" ? { resolved_at: new Date().toISOString(), resolved_by: userId } : {}),
      })
      .eq("id", eventId)
      .eq("restaurant_id", profile.restaurantId)
      .eq("status", current.status)
      .select("id, status")
      .maybeSingle();

    if (updateError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar o evento.");
    }
    if (!updated) {
      throw new AppError(
        "CONFLICT",
        "Este evento foi alterado por outra pessoa. Recarregue a página e tente novamente.",
      );
    }

    return apiSuccess(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
