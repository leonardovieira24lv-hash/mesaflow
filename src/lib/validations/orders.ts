import { z } from "zod";
import { AppError } from "@/lib/api/errors";
import type { OrderStatus } from "@/types/domain";

/**
 * Schemas do módulo de Pedidos (contrato seções 3 e 8). Mesmo padrão dos
 * demais módulos (`lib/validations/menu.ts`, `lib/validations/tables.ts`):
 * usados tanto no formulário/carrinho (feedback imediato, Fases 3/4) quanto
 * no Route Handler (validação real — seção 1.7 do contrato).
 */

// Espelha `orders.status` (migration 0001_initial_schema.sql) e `OrderStatus`
// (types/domain.ts) — conjunto fechado, nunca strings livres inventadas
// endpoint a endpoint.
export const ORDER_STATUS_VALUES: readonly OrderStatus[] = [
  "pending",
  "preparing",
  "ready",
  "delivered",
  "cancelled",
];

// ── Área do Cliente (Pública) — seção 3.3 ───────────────────────────────────

const orderNotesSchema = z
  .string()
  .trim()
  .max(500, "Observação muito longa.")
  .optional()
  .or(z.literal(""));

export const createOrderItemSchema = z.object({
  menu_item_id: z.string().uuid("Produto inválido."),
  quantity: z
    .number({ invalid_type_error: "Informe uma quantidade válida." })
    .int("A quantidade deve ser um número inteiro.")
    .positive("A quantidade deve ser maior que zero."),
  notes: orderNotesSchema,
});
export type CreateOrderItemInput = z.infer<typeof createOrderItemSchema>;

export const createOrderSchema = z.object({
  table_token: z.string().trim().min(1, "Informe o token da mesa."),
  notes: orderNotesSchema,
  items: z.array(createOrderItemSchema).min(1, "O pedido precisa ter ao menos um item."),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ── Administrativo — seção 8 ────────────────────────────────────────────────

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

// `status` (filtro de listagem, seção 8.1) fica fora deste schema de
// propósito: chega como lista separada por vírgula
// (`?status=pending,preparing`), não um único valor — validado por
// `parseOrderStatusFilter` abaixo, que também precisa devolver `details` por
// valor individualmente inválido, algo que um `z.enum` sozinho não expressa
// bem para uma lista.
export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(MAX_PER_PAGE).default(DEFAULT_PER_PAGE),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

/**
 * Valida e converte o filtro `?status=` (seção 8.1: um ou mais valores
 * separados por vírgula) em uma lista de `OrderStatus`. Lança
 * `400 VALIDATION_ERROR` se algum valor estiver fora do conjunto permitido
 * (seção 8.1: "valor de status fora do conjunto permitido"), listando em
 * `details` exatamente quais valores são inválidos.
 */
export function parseOrderStatusFilter(raw: string | null): OrderStatus[] | undefined {
  if (!raw) return undefined;

  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const invalid = values.filter((value) => !ORDER_STATUS_VALUES.includes(value as OrderStatus));

  if (invalid.length > 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Filtro de status inválido.",
      invalid.map((value) => ({ field: "status", issue: `"${value}" não é um status válido.` })),
    );
  }

  return values as OrderStatus[];
}

// Seção 8.3: só estados alcançáveis por transição administrativa —
// `pending` nunca é um destino válido de PATCH, é só o estado inicial da
// criação do pedido (seção 3.3), nunca definido manualmente depois.
const UPDATABLE_ORDER_STATUS_VALUES = ["preparing", "ready", "delivered", "cancelled"] as const;

export const updateOrderStatusSchema = z.object({
  status: z.enum(UPDATABLE_ORDER_STATUS_VALUES, {
    invalid_type_error: "Status inválido. Use preparing, ready, delivered ou cancelled.",
  }),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
