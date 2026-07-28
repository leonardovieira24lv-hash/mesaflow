import { z } from "zod";

/**
 * Schemas do módulo de Cardápio (contrato seções 5 e 6). Mesmo padrão dos
 * demais módulos: usados tanto no formulário (feedback imediato) quanto no
 * Route Handler (validação real — seção 1.7 do contrato).
 */

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da categoria."),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

// Mesmas regras da criação (seção 5.3): só `name`, sempre opcional aqui
// porque um PATCH pode, em teoria, vir vazio — o Route Handler decide o que
// fazer nesse caso, a validação só garante que, se vier, é válido.
export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da categoria.").optional(),
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const reorderCategoriesSchema = z.object({
  ordered_ids: z
    .array(z.string().uuid("Lista de categorias inválida."))
    .min(1, "Informe ao menos uma categoria.")
    // Correção de auditoria: sem este `.refine`, um `ordered_ids` com um id
    // repetido e outro ausente (ex.: existentes {1,2,3}, enviado [1,2,3,3])
    // tinha o mesmo conjunto de membros distintos das categorias existentes
    // e passava incólume pela checagem de "mesmo conjunto" feita na Route
    // Handler (`menu/categories/order/route.ts`), que só compara tamanhos e
    // pertencimento de `Set`s — não é uma permutação válida e duplicaria a
    // atualização de posição para o id repetido.
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "A lista não pode conter categorias repetidas.",
    }),
});
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;

const priceSchema = z
  .number({ invalid_type_error: "Informe um preço válido." })
  .positive("O preço deve ser maior que zero.");

export const createMenuItemSchema = z.object({
  category_id: z.string().uuid("Selecione uma categoria."),
  name: z.string().trim().min(1, "Informe o nome do produto."),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  price: priceSchema,
  image_url: z.string().trim().url("Informe uma URL de imagem válida.").optional().or(z.literal("")),
  is_available: z.boolean().optional(),
});
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;

// Todos os campos opcionais (PATCH parcial — seção 6.4), mas cada campo
// enviado segue exatamente as mesmas regras da criação.
export const updateMenuItemSchema = z.object({
  category_id: z.string().uuid("Selecione uma categoria.").optional(),
  name: z.string().trim().min(1, "Informe o nome do produto.").optional(),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  price: priceSchema.optional(),
  image_url: z.string().trim().url("Informe uma URL de imagem válida.").optional().or(z.literal("")),
  is_available: z.boolean().optional(),
});
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

// Query string chega sempre como string — os `coerce` abaixo cuidam da
// conversão antes de validar (contrato seção 6.1: `?category_id=`, `?page=`, `?per_page=`).
export const listMenuItemsQuerySchema = z.object({
  category_id: z.string().uuid("Categoria inválida.").optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(MAX_PER_PAGE).default(DEFAULT_PER_PAGE),
});
export type ListMenuItemsQuery = z.infer<typeof listMenuItemsQuerySchema>;
