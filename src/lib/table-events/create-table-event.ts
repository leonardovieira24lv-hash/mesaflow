import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/api/errors";
import type { TableEventType } from "@/types/domain";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface CreatedTableEvent {
  id: string;
  type: TableEventType;
  status: "open";
  createdAt: string;
}

/**
 * Cria um evento de mesa (chamar garçom / solicitar conta) — ou devolve o
 * que já está aberto, se houver. Idempotente de propósito: um cliente pode
 * tocar o botão mais de uma vez (achou que não tinha funcionado, ansiedade
 * de espera) — isso não deveria empilhar N alertas idênticos para a mesma
 * mesa, só um "o garçom já está a caminho" continua valendo. Mesmo
 * raciocínio já usado para `order_sessions` em `create-order.ts` (reaproveita
 * a sessão aberta em vez de abrir outra).
 */
export async function createOrReuseTableEvent(
  admin: AdminClient,
  restaurantId: string,
  tableId: string,
  type: TableEventType,
): Promise<CreatedTableEvent> {
  const { data: existing, error: existingError } = await admin
    .from("table_events")
    .select("id, type, status, created_at")
    .eq("table_id", tableId)
    .eq("type", type)
    .eq("status", "open")
    .maybeSingle();

  if (existingError) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível verificar chamadas em aberto desta mesa.");
  }

  if (existing) {
    return { id: existing.id, type: existing.type as TableEventType, status: "open", createdAt: existing.created_at };
  }

  const { data: created, error: createError } = await admin
    .from("table_events")
    .insert({ restaurant_id: restaurantId, table_id: tableId, type })
    .select("id, type, status, created_at")
    .single();

  if (createError || !created) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível registrar a chamada. Tente novamente.");
  }

  return { id: created.id, type: created.type as TableEventType, status: "open", createdAt: created.created_at };
}
