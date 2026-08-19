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
 *
 * Sistema de Opcionais, Fase 2 (múltipla escolha com limite, 2026-08-14):
 * `selectionType`/`maxSelections`/`required` seguem a mesma defesa em
 * profundidade — o segundo `.refine()` espelha a constraint
 * `option_groups_selection_shape` (migration 0037): grupo `single` nunca
 * tem limite numérico, grupo `multiple` sempre precisa de um limite > 0.
 * Defaults (`selectionType: 'single'`, `required: true`) reproduzem o
 * comportamento da Fase 1 pra quem não mexer nesses campos novos.
 */
const selectionShapeRefinement = (data: { selectionType?: "single" | "multiple"; maxSelections?: number }) => {
  if (data.selectionType === undefined) return true;
  if (data.selectionType === "single") return data.maxSelections === undefined;
  return typeof data.maxSelections === "number" && data.maxSelections > 0;
};
const selectionShapeMessage = {
  message: "Defina até quantas opções o cliente pode marcar (obrigatório em grupos de múltipla escolha).",
  path: ["maxSelections"],
};

export const createOptionGroupSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome do grupo."),
    categoryId: z.string().uuid().optional(),
    menuItemId: z.string().uuid().optional(),
    selectionType: z.enum(["single", "multiple"]).default("single"),
    maxSelections: z.number().int().positive().optional(),
    required: z.boolean().default(true),
    groupType: z.enum(["standard", "size"]).default("standard"),
  })
  .refine((data) => Boolean(data.categoryId) !== Boolean(data.menuItemId), {
    message: "Escolha uma categoria OU um produto específico, nunca os dois.",
    path: ["categoryId"],
  })
  .refine(selectionShapeRefinement, selectionShapeMessage);
export type CreateOptionGroupInput = z.infer<typeof createOptionGroupSchema>;

export const updateOptionGroupSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome do grupo.").optional(),
    selectionType: z.enum(["single", "multiple"]).optional(),
    maxSelections: z.number().int().positive().optional(),
    required: z.boolean().optional(),
  })
  .refine(selectionShapeRefinement, selectionShapeMessage);
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
