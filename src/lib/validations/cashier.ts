import { z } from "zod";

/**
 * Schemas do módulo de Caixa (Sprint "Painel de Caixa", 2026-07-30). Mesmo
 * padrão dos demais módulos: usados tanto no cliente (feedback imediato,
 * montagem da query string) quanto no Route Handler (validação real).
 */

export const CASHIER_PERIOD_VALUES = ["today", "yesterday", "7d", "30d", "custom"] as const;
export type CashierPeriod = (typeof CASHIER_PERIOD_VALUES)[number];

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

// Query string chega sempre como string — `coerce` cuida da conversão
// antes de validar. `start_date`/`end_date` só são obrigatórios quando
// `period` é "custom" (checado no `.refine()` abaixo).
export const cashierListQuerySchema = z
  .object({
    period: z.enum(CASHIER_PERIOD_VALUES).default("today"),
    start_date: z.string().trim().optional(),
    end_date: z.string().trim().optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).default(1),
    per_page: z.coerce.number().int().min(1).max(MAX_PER_PAGE).default(DEFAULT_PER_PAGE),
  })
  .refine((data) => data.period !== "custom" || (data.start_date && data.end_date), {
    message: "Informe a data inicial e final do período personalizado.",
    path: ["start_date"],
  });
export type CashierListQuery = z.infer<typeof cashierListQuerySchema>;
