import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";
import type { RestaurantStatus } from "@/types/domain";
import type { Database } from "@/types/database.types";
import type { OpeningHours } from "@/lib/validations/restaurant";
import type { PaymentMethod } from "@/lib/cashier/queries";

export interface RestaurantOverview {
  id: string;
  name: string;
  slug: string;
  status: RestaurantStatus;
  // Dados cadastrais (Sprint "Gestão do Restaurante", 2026-08-07) — todos
  // `nullable`, refletindo as colunas recém-adicionadas em `restaurants`
  // (`0025_restaurant_registration_fields.sql`). Não fazem parte do
  // `checklist`/`counts` abaixo (que servem só onboarding/Dashboard); só
  // são consumidos por `GET /api/v1/restaurant` para a tela de
  // Configurações.
  tradeName: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  postalCode: string | null;
  street: string | null;
  streetNumber: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  instagram: string | null;
  facebook: string | null;
  website: string | null;
  // Identidade — Sprint "Perfil do Restaurante, Fase 1" (2026-08-09),
  // colunas de `0026_restaurant_logo_and_description.sql`. Mesmo raciocínio
  // dos campos acima: só para a tela de Configurações, fora do
  // `checklist`/`counts`.
  logoUrl: string | null;
  description: string | null;
  // Operação — Fase 4A (2026-08-10), colunas de
  // `0028_restaurant_operation_settings.sql`. `openingHours` fica `null`
  // quando o proprietário ainda não configurou nada — estado distinto de
  // "todo dia fechado" (objeto com os 7 dias como array vazio). Mesmo
  // raciocínio dos campos acima: só para a tela de Configurações, fora do
  // `checklist`/`counts`.
  openingHours: OpeningHours | null;
  acceptedPaymentMethods: PaymentMethod[];
  // Timezone — Fase 4B.2 (2026-08-10), coluna de
  // `0029_restaurant_timezone.sql`. Sempre uma string (nunca `null`) —
  // `not null default 'America/Sao_Paulo'` garante isso desde o schema.
  timezone: string;
  // Etapa 1 — Tema do Cardápio Público (2026-08-11), coluna de
  // `0030_restaurant_menu_theme.sql`. Sempre 'light'|'dark' — `not null
  // default 'dark'` garante isso desde o schema. Só persistido nesta
  // etapa; nenhuma tela pública lê ainda.
  menuTheme: "light" | "dark";
  checklist: {
    hasCategories: boolean;
    hasProducts: boolean;
    qrCodesPrinted: boolean;
  };
  counts: {
    tables: number;
    categories: number;
    products: number;
  };
}

/**
 * Busca o restaurante do usuário autenticado + o estado do checklist de
 * onboarding + contadores agregados. Usada em dois lugares:
 *
 *  - `GET /api/v1/restaurant` (contrato seção 4.1) devolve só o subconjunto
 *    definido no contrato (`id`, `name`, `slug`, `status`, `checklist`).
 *  - O Dashboard (Server Component) chama isto **diretamente**, sem passar
 *    pela própria API — um Server Component fazer fetch da sua própria
 *    Route Handler é um anti-padrão no Next.js (round-trip HTTP
 *    desnecessário); ele já roda no servidor e pode reusar a mesma função.
 *    Os campos extras (`counts`) alimentam os cards de resumo do Dashboard
 *    e não fazem parte do contrato de API — são dado de exibição interno
 *    da página, não um recurso versionado.
 *
 * Todas as contagens dependem das políticas de RLS de leitura adicionadas
 * em `supabase/migrations/0004_dashboard_reads.sql`.
 *
 * Sprint "Exclusão Lógica de Produtos" (2026-07-28): a contagem de
 * `products` (e o `hasProducts` do checklist) passou a excluir produtos
 * arquivados (`is_archived = true`) — eles saíram do catálogo ativo do
 * dono, então não devem contar como produto cadastrado nem no Dashboard
 * nem no checklist de onboarding.
 */
export async function getRestaurantOverview(
  supabase: SupabaseClient<Database>,
  restaurantId: string,
): Promise<RestaurantOverview> {
  const [restaurantResult, categoriesResult, productsResult, tablesResult] = await Promise.all([
    supabase
      .from("restaurants")
      .select(
        "id, name, slug, status, qr_codes_printed_at, trade_name, phone, whatsapp, email, postal_code, street, street_number, neighborhood, city, state, instagram, facebook, website, logo_url, description, opening_hours, accepted_payment_methods, timezone, menu_theme",
      )
      .eq("id", restaurantId)
      .single(),
    supabase
      .from("menu_categories")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
    supabase.from("menu_items").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).eq("is_archived", false),
    supabase.from("tables").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId),
  ]);

  if (restaurantResult.error || !restaurantResult.data) {
    throw new AppError("NOT_FOUND", "Restaurante não encontrado.");
  }

  const restaurant = restaurantResult.data;
  const categoriesCount = categoriesResult.count ?? 0;
  const productsCount = productsResult.count ?? 0;

  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    status: restaurant.status,
    tradeName: restaurant.trade_name,
    phone: restaurant.phone,
    whatsapp: restaurant.whatsapp,
    email: restaurant.email,
    postalCode: restaurant.postal_code,
    street: restaurant.street,
    streetNumber: restaurant.street_number,
    neighborhood: restaurant.neighborhood,
    city: restaurant.city,
    state: restaurant.state,
    instagram: restaurant.instagram,
    facebook: restaurant.facebook,
    website: restaurant.website,
    logoUrl: restaurant.logo_url,
    description: restaurant.description,
    openingHours: restaurant.opening_hours as OpeningHours | null,
    acceptedPaymentMethods: restaurant.accepted_payment_methods as PaymentMethod[],
    timezone: restaurant.timezone,
    menuTheme: restaurant.menu_theme as "light" | "dark",
    checklist: {
      hasCategories: categoriesCount > 0,
      hasProducts: productsCount > 0,
      qrCodesPrinted: restaurant.qr_codes_printed_at !== null,
    },
    counts: {
      tables: tablesResult.count ?? 0,
      categories: categoriesCount,
      products: productsCount,
    },
  };
}
