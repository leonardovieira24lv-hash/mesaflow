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
});
export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;
