import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/api/errors";
import type { OpeningHours } from "@/lib/validations/restaurant";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface PublicRestaurantContext {
  id: string;
  name: string;
  slug: string;
  // Identidade — Sprint "Identidade do Restaurante no Cardápio Público"
  // (2026-08-09). Colunas já existentes desde a Sprint "Perfil do
  // Restaurante" (`0025_restaurant_registration_fields.sql`,
  // `0026_restaurant_logo_and_description.sql`) — nenhuma migration nova
  // aqui, só passaram a ser selecionadas por esta função.
  tradeName: string | null;
  logoUrl: string | null;
  description: string | null;
  // Banner promocional — estudo de caso de concorrentes (2026-08-16).
  // `enabled` decide se o Cardápio Público mostra o banner (E precisa de
  // `imageUrl` também não-nulo) — ver `cardapio-cliente-view.tsx`.
  promoBannerImageUrl: string | null;
  promoBannerText: string | null;
  promoBannerEnabled: boolean;
  // Redes sociais — Cardápio Público (2026-08-18). Mesmo raciocínio do
  // banner: colunas já existentes desde "Gestão do Restaurante", nunca
  // antes buscadas por esta função — o dono percebeu que preenchia
  // Instagram/Facebook/Site em Configurações/Perfil, mas isso nunca
  // chegava no cliente final. Telefone/WhatsApp/endereço FICARAM DE
  // FORA de propósito (decisão do dono: cliente já está fisicamente no
  // estabelecimento, essas informações são redundantes nesse contexto —
  // só redes sociais fazem sentido, pra seguir/engajar mesmo estando lá).
  instagram: string | null;
  facebook: string | null;
  website: string | null;
  // Operação — Fase 4B.2 (2026-08-10), colunas de
  // `0028_restaurant_operation_settings.sql`/`0029_restaurant_timezone.sql`.
  // `openingHours` fica `null` quando o proprietário nunca configurou nada
  // (distinto de "todo dia fechado"). `timezone` nunca é `null` — a coluna
  // é `not null default 'America/Sao_Paulo'`.
  openingHours: OpeningHours | null;
  timezone: string;
  // Etapa 1 — Tema do Cardápio Público (2026-08-11), coluna de
  // `0030_restaurant_menu_theme.sql`. Sempre 'light'|'dark' — `not null
  // default 'dark'` garante isso desde o schema. Etapa 2: propagado aqui
  // pra decidir, na raiz de cada página pública, se a classe `menu-dark`
  // deve ser aplicada.
  menuTheme: "light" | "dark";
  businessType: string | null;
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
    .select(
      "id, name, slug, trade_name, logo_url, description, promo_banner_image_url, promo_banner_text, promo_banner_enabled, instagram, facebook, website, opening_hours, timezone, menu_theme, business_type",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível carregar o restaurante.");
  }
  if (!data) {
    throw new AppError("NOT_FOUND", "Restaurante não encontrado.");
  }

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    tradeName: data.trade_name,
    logoUrl: data.logo_url,
    description: data.description,
    promoBannerImageUrl: data.promo_banner_image_url,
    promoBannerText: data.promo_banner_text,
    promoBannerEnabled: data.promo_banner_enabled,
    instagram: data.instagram,
    facebook: data.facebook,
    website: data.website,
    openingHours: data.opening_hours as OpeningHours | null,
    timezone: data.timezone,
    menuTheme: data.menu_theme as "light" | "dark",
    businessType: data.business_type ?? null,
  };
}

/**
 * Nome de exibição do restaurante nas 4 telas públicas (Cardápio, Carrinho,
 * Checkout, Acompanhamento) — Sprint "Identidade do Restaurante no Cardápio
 * Público" (2026-08-09). Centralizado aqui, único lugar, para as 4 páginas
 * nunca divergirem entre si na prioridade do nome.
 *
 * `trade_name` (nome fantasia, se o proprietário preencheu no Perfil) tem
 * prioridade sobre `name` (razão social/nome de cadastro, usado como
 * fallback). `slug` nunca entra nessa conta — continua exclusivamente como
 * identificador da URL pública, nunca como nome visual.
 */
export function getRestaurantDisplayName(restaurant: Pick<PublicRestaurantContext, "name" | "tradeName">): string {
  return restaurant.tradeName?.trim() || restaurant.name;
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * Status "aberto agora"/"fechado agora" do restaurante, calculado no
 * horário LOCAL dele (nunca o do servidor, nunca o do visitante) — Fase
 * 4B.2 (2026-08-10). Mesma centralização de `getRestaurantDisplayName()`
 * logo acima: uma função só, chamada 1x por página pública que precisar
 * (hoje, só o Cardápio), nunca replicada.
 *
 * `now` é injetável de propósito (default `new Date()`) — a função fica
 * pura e testável sem precisar mockar relógio global.
 *
 * `Intl.DateTimeFormat` com `timeZone` (API nativa, sem biblioteca) resolve
 * o problema de fuso de verdade: converte o instante atual (que é sempre
 * um ponto absoluto no tempo, independente de onde o código roda) pro
 * dia-da-semana e hora LOCAIS do fuso do restaurante — o servidor
 * (Vercel, UTC por padrão) e o navegador de quem está olhando o cardápio
 * nunca entram nessa conta.
 *
 * `opening_hours[dia] = []` → fechado o dia inteiro (retorna `false`, não
 * `null` — a ausência de período naquele dia é uma configuração válida,
 * diferente de "nunca configurado"). Só devolve `null` quando não há como
 * responder de forma confiável: sem `opening_hours` nenhum, ou dado
 * estruturalmente inconsistente (nunca deveria acontecer, dado que o
 * `PATCH /api/v1/restaurant` já valida via Zod antes de salvar — mas um
 * registro antigo/editado direto no banco pode fugir disso; a resposta
 * segura é não mostrar status nenhum, nunca inventar um errado). Mesmo
 * princípio já usado no schema atual: comparação de strings "HH:MM" decide
 * tudo (abertura inclusiva, fechamento exclusivo) — nenhuma conversão para
 * minutos/`Date` é necessária, o formato já ordena corretamente como
 * texto.
 */
export function getRestaurantOpenStatus(
  restaurant: Pick<PublicRestaurantContext, "openingHours" | "timezone">,
  now: Date = new Date(),
): boolean | null {
  const { openingHours, timezone } = restaurant;
  if (!openingHours || typeof openingHours !== "object") return null;

  let weekdayIndex: number;
  let hhmm: string;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);

    const weekdayShort = (parts.find((p) => p.type === "weekday")?.value ?? "").toLowerCase();
    const hour = parts.find((p) => p.type === "hour")?.value ?? "";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "";

    weekdayIndex = DAY_KEYS.findIndex((day) => weekdayShort.startsWith(day));
    hhmm = `${hour}:${minute}`;

    if (weekdayIndex === -1 || !hour || !minute) return null;
  } catch {
    // `timezone` inválido (não deveria acontecer — validado no PATCH — mas
    // um dado antigo/editado direto no banco pode fugir disso).
    return null;
  }

  const dayKey = DAY_KEYS[weekdayIndex];
  if (!dayKey) return null;

  const periods = openingHours[dayKey];
  if (!Array.isArray(periods)) return null;
  if (periods.length === 0) return false;

  return periods.some((period) => {
    if (!period || typeof period.open !== "string" || typeof period.close !== "string") return false;
    return hhmm >= period.open && hhmm < period.close;
  });
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
