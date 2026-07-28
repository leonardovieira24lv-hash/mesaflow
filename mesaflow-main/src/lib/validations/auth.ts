import { z } from "zod";

/**
 * Schemas de validação do módulo de autenticação. Usados no cliente (forms
 * de login/recuperação de senha) antes de chamar o SDK do Supabase Auth —
 * essas telas não têm Route Handler próprio (contrato seção 9: login e
 * recuperação de senha são operações padrão do provedor, não regra de
 * negócio do domínio), então a validação de payload acontece aqui, não em
 * `lib/api/validation.ts`.
 */

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Informe seu e-mail.")
    .email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Informe seu e-mail.")
    .email("Informe um e-mail válido."),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// Mesma política mínima de senha usada no onboarding (contrato seção 2.1).
const PASSWORD_MIN_LENGTH = 6;

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`),
    confirmPassword: z.string().min(1, "Confirme sua nova senha."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
