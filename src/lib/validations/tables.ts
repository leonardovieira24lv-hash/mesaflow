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

// Espelha `order_sessions.payment_method` (migration 0017). Só estas 4
// formas nesta sprint — pagamento misto (dividir entre duas formas) fica
// para uma sprint futura, por pedido explícito do dono.
export const PAYMENT_METHOD_VALUES = ["pix", "credit_card", "debit_card", "cash"] as const;

/**
 * Normaliza `restaurants.accepted_payment_methods` (Fase 4B.1,
 * 2026-08-10) com o mesmo fallback defensivo dos dois pontos que a
 * consomem — `close-bill-modal.tsx` (UI) e `close-bill/route.ts`
 * (backend), única fonte da regra, para os dois nunca divergirem.
 *
 * Se o valor não for um array, vier vazio, ou não sobrar nenhum valor
 * válido depois de filtrar contra `PAYMENT_METHOD_VALUES` (dado
 * inconsistente — nunca deveria acontecer, já que o `PATCH
 * /api/v1/restaurant` da Fase 4A exige pelo menos 1 via Zod, mas um
 * registro antigo/editado direto no banco pode fugir disso), cai nas 4
 * formas atuais — nunca trava o fechamento de conta por causa de uma
 * configuração ausente ou corrompida. Valores inválidos misturados com
 * válidos são só descartados individualmente, sem descartar o restante.
 */
export function resolveAcceptedPaymentMethods(value: unknown): (typeof PAYMENT_METHOD_VALUES)[number][] {
  if (!Array.isArray(value)) return [...PAYMENT_METHOD_VALUES];

  const valid = value.filter((item): item is (typeof PAYMENT_METHOD_VALUES)[number] =>
    (PAYMENT_METHOD_VALUES as readonly string[]).includes(item as string),
  );

  return valid.length > 0 ? valid : [...PAYMENT_METHOD_VALUES];
}

// Sprint "Fechamento de Conta com Registro de Venda": corpo de
// `PATCH /api/v1/tables/{id}/close-bill` — a única informação que o
// atendente decide neste passo é a forma de pagamento.
export const closeBillSchema = z.object({
  payment_method: z.enum(PAYMENT_METHOD_VALUES, {
    required_error: "Selecione a forma de pagamento.",
    invalid_type_error: "Forma de pagamento inválida.",
  }),
});
export type CloseBillInput = z.infer<typeof closeBillSchema>;
