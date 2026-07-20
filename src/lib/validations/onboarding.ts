import { z } from "zod";

/**
 * Schemas do fluxo de onboarding (contrato seção 2). Usados nos dois lados:
 * no formulário (validação imediata, melhor UX) e no Route Handler
 * correspondente (validação real, nunca confiando só no cliente — seção
 * 1.7 do contrato).
 */

// Mesma política mínima de senha referenciada no módulo de autenticação.
const PASSWORD_MIN_LENGTH = 6;

export const createRestaurantSchema = z.object({
  owner_name: z.string().trim().min(2, "Informe seu nome completo."),
  restaurant_name: z
    .string()
    .trim()
    .min(2, "O nome do restaurante deve ter pelo menos 2 caracteres."),
  email: z.string().trim().min(1, "Informe seu e-mail.").email("Informe um e-mail válido."),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`),
});
export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;

// Acima disso, o contrato orienta contato com o suporte em vez de criação automática.
export const MAX_ONBOARDING_TABLES = 200;

export const createTablesSchema = z.object({
  quantity: z
    .number({ invalid_type_error: "Informe um número de mesas." })
    .int("A quantidade deve ser um número inteiro.")
    .min(1, "Cadastre pelo menos 1 mesa.")
    .max(
      MAX_ONBOARDING_TABLES,
      `Para mais de ${MAX_ONBOARDING_TABLES} mesas, fale com o nosso suporte.`,
    ),
});
export type CreateTablesInput = z.infer<typeof createTablesSchema>;
