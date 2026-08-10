import { z } from "zod";

/**
 * Schema de criação de funcionário (Fase 3 — Gestão de Equipe, 2026-08-09).
 * Mesma política mínima de senha já usada no onboarding
 * (`lib/validations/onboarding.ts`) — redeclarada aqui, não importada, para
 * não tocar em um arquivo fora do escopo desta Sprint por uma única
 * constante.
 */
const PASSWORD_MIN_LENGTH = 6;

export const createStaffSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do funcionário."),
  email: z.string().trim().min(1, "Informe o e-mail.").email("Informe um e-mail válido."),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`),
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
