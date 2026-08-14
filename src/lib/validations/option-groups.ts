import { z } from "zod";

/**
 * Sistema de Opcionais, Fase 1 (escolha única obrigatória) — mesmo padrão
 * de `lib/validations/menu.ts`: usados tanto no formulário quanto no
 * Route Handler.
 *
 * `createOptionGroupSchema`: exige exatamente um entre `categoryId`/
 * `menuItemId` — mesma regra da migration (`option_groups_exactly_one_target`,
 * `0036`), validada aqui também (defesa em profundidade, não confiar só
 * na constraint do banco pra dar uma mensagem de erro legível ao usuário).
 */
export const createOptionGroupSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome do grupo."),
    categoryId: z.string().uuid().optional(),
    menuItemId: z.string().uuid().optional(),
  })
  .refine((data) => Boolean(data.categoryId) !== Boolean(data.menuItemId), {
    message: "Escolha uma categoria OU um produto específico, nunca os dois.",
    path: ["categoryId"],
  });
export type CreateOptionGroupInput = z.infer<typeof createOptionGroupSchema>;

export const updateOptionGroupSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do grupo.").optional(),
});
export type UpdateOptionGroupInput = z.infer<typeof updateOptionGroupSchema>;

export const createOptionGroupItemSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da opção."),
  priceDelta: z.coerce.number().min(0, "O valor não pode ser negativo."),
});
export type CreateOptionGroupItemInput = z.infer<typeof createOptionGroupItemSchema>;

export const updateOptionGroupItemSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da opção.").optional(),
  priceDelta: z.coerce.number().min(0, "O valor não pode ser negativo.").optional(),
});
export type UpdateOptionGroupItemInput = z.infer<typeof updateOptionGroupItemSchema>;
