import { z } from "zod";

/**
 * Schemas do módulo de Mesas e QR Codes (contrato seção 7). Mesmo padrão dos
 * demais módulos (`lib/validations/menu.ts`): usados tanto no formulário
 * (feedback imediato) quanto no Route Handler (validação real — seção 1.7).
 */

// Contrato 7.2: "name" é opcional — se omitido, o Route Handler gera
// automaticamente o próximo número sequencial. A validação aqui só garante
// que, se o nome vier preenchido, ele é uma string não vazia.
export const createTableSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da mesa.").optional(),
});
export type CreateTableInput = z.infer<typeof createTableSchema>;

// Espelha `tables.status` (migration 0001) e `TableStatus` (types/domain.ts).
export const TABLE_STATUS_VALUES = ["livre", "ocupada", "manutencao"] as const;

// Contrato 7.3: "name" e "status" são ambos opcionais (PATCH parcial) — o
// Route Handler decide o que atualizar a partir do que foi de fato enviado.
export const updateTableSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da mesa.").optional(),
  status: z.enum(TABLE_STATUS_VALUES, {
    invalid_type_error: "Status inválido. Use livre, ocupada ou manutencao.",
  }).optional(),
});
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
