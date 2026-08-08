import { z } from "zod";

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
});
export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;
