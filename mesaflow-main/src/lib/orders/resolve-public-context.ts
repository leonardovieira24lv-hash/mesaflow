import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/api/errors";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface PublicRestaurantContext {
  id: string;
  name: string;
  slug: string;
}

export interface PublicTableContext {
  id: string;
  name: string;
}

/**
 * Resolve o restaurante pelo `slug` da URL usando o cliente admin (service
 * role) — endpoints públicos (contrato seção 1.6, "Área do Cliente") não têm
 * `auth.uid()`, então nenhuma política de RLS baseada em sessão poderia
 * autorizar esta leitura de qualquer forma. Mesmo raciocínio já registrado
 * em `supabase/migrations/0007_orders_module.sql` e usado no onboarding
 * (`src/lib/supabase/admin.ts`).
 *
 * Lança `404 NOT_FOUND` se o slug não existir — nunca revela mais detalhe
 * que isso (contrato 3.1).
 */
export async function resolveRestaurantBySlug(
  admin: AdminClient,
  slug: string,
): Promise<PublicRestaurantContext> {
  const { data, error } = await admin
    .from("restaurants")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível carregar o restaurante.");
  }
  if (!data) {
    throw new AppError("NOT_FOUND", "Restaurante não encontrado.");
  }

  return data;
}

/**
 * Resolve a mesa pelo `qr_token`, restrita ao restaurante já resolvido
 * (contrato 3.1). Usa o mesmo código `404` tanto para slug quanto para
 * token inválido — de propósito, para não revelar qual dos dois falhou.
 *
 * Sprint 1 de Correção (Fase de Estabilização): mesas com
 * `status = 'manutencao'` agora são rejeitadas aqui com `409 CONFLICT` —
 * antes desta correção, nada impedia o cardápio de carregar nem um pedido
 * de ser criado numa mesa marcada como indisponível pelo restaurante
 * (`resolveTableByToken` é usado tanto pela página resolvedora do QR Code
 * quanto por `POST /api/v1/public/{slug}/orders`, então esta única checagem
 * cobre os dois pontos de entrada). Usa `CONFLICT` — código já existente no
 * catálogo fechado de erros — em vez de um código novo; a mesa foi
 * encontrada de verdade, só não está disponível agora.
 */
export async function resolveTableByToken(
  admin: AdminClient,
  restaurantId: string,
  token: string,
): Promise<PublicTableContext> {
  const { data, error } = await admin
    .from("tables")
    .select("id, name, status")
    .eq("restaurant_id", restaurantId)
    .eq("qr_token", token)
    .maybeSingle();

  if (error) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível carregar a mesa.");
  }
  if (!data) {
    throw new AppError("NOT_FOUND", "Mesa não encontrada.");
  }
  if (data.status === "manutencao") {
    throw new AppError("CONFLICT", "Esta mesa está temporariamente indisponível. Chame o atendente.");
  }

  return { id: data.id, name: data.name };
}
