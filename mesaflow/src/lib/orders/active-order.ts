import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/api/errors";
import type { OrderStatus } from "@/types/domain";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface ActiveOrderSummary {
  id: string;
  status: OrderStatus;
}

/**
 * Resolve o pedido em andamento de uma mesa (contrato 3.1: campo
 * `active_order`) — "em andamento" = ainda não chegou a um status terminal
 * (`delivered`/`cancelled`). Usado para retomar o acompanhamento em vez de
 * reiniciar o cardápio do zero.
 *
 * Extraído de dentro do Route Handler
 * (`api/v1/public/[slug]/tables/[token]/route.ts`) nesta fase para que a
 * página resolvedora de mesa (Fase 3) reaproveite a mesma query, em vez de
 * duplicá-la — o comportamento do endpoint não mudou.
 */
export async function getActiveOrderForTable(
  admin: AdminClient,
  tableId: string,
): Promise<ActiveOrderSummary | null> {
  const { data, error } = await admin
    .from("orders")
    .select("id, status")
    .eq("table_id", tableId)
    .not("status", "in", "(delivered,cancelled)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível verificar o pedido ativo da mesa.");
  }

  return data ? { id: data.id, status: data.status as OrderStatus } : null;
}
