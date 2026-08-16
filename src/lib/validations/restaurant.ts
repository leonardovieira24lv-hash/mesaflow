import { z } from "zod";
import { PAYMENT_METHOD_VALUES } from "@/lib/validations/tables";

/**
 * Schema do módulo de Configurações do Restaurante (contrato seção 4.2).
 * Mesmo padrão dos demais módulos (`lib/validations/menu.ts`,
 * `lib/validations/tables.ts`): usado tanto no formulário (feedback
 * imediato) quanto no Route Handler (validação real — seção 1.7 do
 * contrato).
 *
 * O contrato define `name` e `slug` como ambos **opcionais** no payload do
 * PATCH — um permite atualizar só um dos dois campos por vez. O que esta
 * sprint chama de "slug obrigatório" nas validações não contradiz isso: não
 * é a *presença* do campo que é obrigatória em toda chamada (isso
 * quebraria o contrato 4.2, que é a fonte da verdade e nunca deve ser
 * contradita — ver `README.md`), e sim que, **quando o campo é enviado**,
 * ele não pode ser uma string vazia nem fugir do formato exigido pelo
 * contrato ("somente letras minúsculas, números e hífen").
 */

// Mesmo formato de slug usado no onboarding (`lib/slug.ts` gera slugs que já
// respeitam esta regra) — aqui a validação é a contraparte que impede o
// usuário de digitar um slug fora do padrão na tela de Configurações.
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Fase 4A — Operação (2026-08-10). `HH:MM`, 24h, mesmo formato que o
// `<input type="time">` nativo já produz — nenhuma conversão necessária
// entre o que o navegador devolve e o que é validado/salvo.
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const openingPeriodSchema = z
  .object({
    open: z.string().regex(TIME_REGEX, "Use o formato HH:MM."),
    close: z.string().regex(TIME_REGEX, "Use o formato HH:MM."),
  })
  .refine((period) => period.open < period.close, {
    message: "O horário de fechamento deve ser depois do de abertura.",
    path: ["close"],
  });

// Comparação lexicográfica de strings "HH:MM" já ordena corretamente por
// horário (mesmo truque usado no `.refine` acima) — não precisa converter
// para minutos/Date para comparar.
function hasOverlappingPeriods(periods: { open: string; close: string }[]): boolean {
  const sorted = [...periods].sort((a, b) => (a.open < b.open ? -1 : a.open > b.open ? 1 : 0));
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const previous = sorted[i - 1];
    if (!current || !previous) continue;
    if (current.open < previous.close) return true;
  }
  return false;
}

const daySchema = z
  .array(openingPeriodSchema)
  .refine((periods) => !hasOverlappingPeriods(periods), { message: "Os períodos não podem se sobrepor." });

// Estrutura recomendada pela auditoria da Fase 4 — um array de períodos por
// dia da semana (array vazio = dia fechado), permitindo mais de um período
// no mesmo dia (ex.: almoço e jantar). Chaves fixas (não `Record<string,
// ...>` livre) — os 7 dias são sempre os mesmos, sem risco de chave
// inválida entrar no JSON salvo.
export const openingHoursSchema = z.object({
  mon: daySchema,
  tue: daySchema,
  wed: daySchema,
  thu: daySchema,
  fri: daySchema,
  sat: daySchema,
  sun: daySchema,
});
export type OpeningHours = z.infer<typeof openingHoursSchema>;

// Mesmos 4 valores de `order_sessions.payment_method`
// (`lib/validations/tables.ts`, fonte única — não redeclarados aqui, para
// nunca divergir). Pelo menos 1 selecionado: um restaurante sem nenhuma
// forma de pagamento aceita não consegue fechar conta nenhuma.
export const acceptedPaymentMethodsSchema = z
  .array(z.enum(PAYMENT_METHOD_VALUES))
  .min(1, "Selecione pelo menos uma forma de pagamento.");

// Fase 4B.2 — Timezone (2026-08-10). Validação genérica de qualquer
// identificador IANA válido (não restrita à lista curada abaixo, que é só
// para o dropdown da UI) — `Intl.DateTimeFormat` já sabe validar isso
// nativamente, sem precisar manter uma lista exaustiva de fusos só para
// checar validade. Mesma API usada no cálculo de aberto/fechado
// (`getRestaurantOpenStatus`, `lib/orders/resolve-public-context.ts`), pra
// nunca aceitar aqui um valor que o cálculo depois rejeitaria.
export const timezoneSchema = z
  .string()
  .trim()
  .refine((tz) => {
    try {
      // eslint-disable-next-line no-new -- só testando se `tz` é aceito, sem usar o formatador.
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Fuso horário inválido.");

// Lista curada, não exaustiva — cobre os fusos brasileiros e alguns
// internacionais comuns, o suficiente para a primeira versão sem inflar o
// escopo. Qualquer identificador IANA válido é aceito pelo backend
// (`timezoneSchema`, acima); esta lista é só a opção mais conveniente na
// tela de Operação, não uma restrição.
export const TIMEZONE_OPTIONS = [
  { value: "America/Noronha", label: "Fernando de Noronha (UTC−02:00)" },
  { value: "America/Sao_Paulo", label: "Brasília, São Paulo, Rio de Janeiro (UTC−03:00)" },
  { value: "America/Bahia", label: "Salvador (UTC−03:00)" },
  { value: "America/Fortaleza", label: "Fortaleza, Recife (UTC−03:00)" },
  { value: "America/Belem", label: "Belém (UTC−03:00)" },
  { value: "America/Manaus", label: "Manaus (UTC−04:00)" },
  { value: "America/Campo_Grande", label: "Campo Grande, Cuiabá (UTC−04:00)" },
  { value: "America/Boa_Vista", label: "Boa Vista, Porto Velho (UTC−04:00)" },
  { value: "America/Rio_Branco", label: "Rio Branco (UTC−05:00)" },
  { value: "America/New_York", label: "Nova York (UTC−05:00)" },
  { value: "America/Los_Angeles", label: "Los Angeles (UTC−08:00)" },
  { value: "Europe/Lisbon", label: "Lisboa (UTC±00:00)" },
  { value: "Europe/London", label: "Londres (UTC±00:00)" },
] as const;

// Etapa 1 — Tema do Cardápio Público (2026-08-11). Só persiste a
// preferência nesta etapa; nenhuma tela pública lê isto ainda (propagação
// é etapa futura, aprovada separadamente).
export const menuThemeSchema = z.enum(["light", "dark"]);

export const updateRestaurantSchema = z.object({
  name: z.string().trim().min(2, "O nome deve ter pelo menos 2 caracteres.").optional(),
  slug: z
    .string()
    .trim()
    .min(3, "O slug deve ter pelo menos 3 caracteres.")
    .max(60, "O slug deve ter no máximo 60 caracteres.")
    .regex(
      SLUG_REGEX,
      "Use apenas letras minúsculas, números e hífen (ex.: meu-restaurante).",
    )
    .optional(),

  // Identidade — Sprint "Perfil do Restaurante, Fase 1" (2026-08-09).
  // `logo_url` aceita string vazia (`""`) além de URL válida: é como o
  // upload zera o campo ao remover o logo (`RestaurantLogoUpload`) — as
  // demais URLs do formulário (`website`) não têm essa necessidade porque
  // nunca são preenchidas/limpas por um botão de remoção dedicado.
  description: z.string().trim().max(1000, "A descrição deve ter no máximo 1000 caracteres.").optional(),
  logo_url: z
    .union([z.string().trim().url("URL do logo inválida."), z.literal("")])
    .optional(),

  // Banner promocional — estudo de caso de concorrentes (2026-08-16).
  // Mesmo raciocínio de `logo_url`: string vazia é uma intenção válida
  // ("remover a imagem"), não ausência.
  promo_banner_image_url: z
    .union([z.string().trim().url("URL do banner inválida."), z.literal("")])
    .optional(),
  promo_banner_text: z.string().trim().max(200, "O texto do banner deve ter no máximo 200 caracteres.").optional(),
  promo_banner_enabled: z.boolean().optional(),

  // Dados cadastrais (Sprint "Gestão do Restaurante", 2026-08-07) — mesmo
  // espírito do PATCH parcial já usado para `name`/`slug` acima: todos
  // opcionais, só entra no `update` o que for de fato enviado.
  trade_name: z.string().trim().min(2, "O nome fantasia deve ter pelo menos 2 caracteres.").max(120).optional(),
  phone: z.string().trim().min(8, "Telefone inválido.").max(20).optional(),
  whatsapp: z.string().trim().min(8, "WhatsApp inválido.").max(20).optional(),
  email: z.string().trim().email("E-mail inválido.").max(160).optional(),
  postal_code: z
    .string()
    .trim()
    .regex(/^\d{5}-?\d{3}$/, "CEP inválido (use o formato 00000-000).")
    .optional(),
  street: z.string().trim().min(1, "Rua inválida.").max(160).optional(),
  street_number: z.string().trim().min(1, "Número inválido.").max(20).optional(),
  neighborhood: z.string().trim().min(1, "Bairro inválido.").max(120).optional(),
  city: z.string().trim().min(1, "Cidade inválida.").max(120).optional(),
  state: z
    .string()
    .trim()
    .regex(/^[a-zA-Z]{2}$/, "Use a sigla do estado com 2 letras (ex.: SP).")
    .transform((value) => value.toUpperCase())
    .optional(),
  instagram: z.string().trim().max(160).optional(),
  facebook: z.string().trim().max(160).optional(),
  website: z.string().trim().url("URL inválida (inclua http:// ou https://).").max(200).optional(),

  // Operação — Fase 4A (2026-08-10).
  opening_hours: openingHoursSchema.optional(),
  accepted_payment_methods: acceptedPaymentMethodsSchema.optional(),
  timezone: timezoneSchema.optional(),
  menu_theme: menuThemeSchema.optional(),
});
export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;
