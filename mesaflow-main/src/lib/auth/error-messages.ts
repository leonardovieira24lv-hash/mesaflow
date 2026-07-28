import type { AuthError } from "@supabase/supabase-js";

/**
 * Traduz os erros do Supabase Auth (mensagens em inglês, específicas da
 * implementação do provedor) para mensagens em português voltadas ao
 * usuário final. Mantido separado do catálogo de erros de negócio
 * (`constants/error-codes.ts`) porque este cobre erros de um SDK de
 * terceiro, não os códigos do contrato de API do MesaFlow.
 *
 * Por segurança, mensagens de credencial inválida são propositalmente
 * genéricas — nunca revelar se o e-mail existe ou não na base.
 */
export function mapAuthError(error: Pick<AuthError, "message" | "status"> | null | undefined): string {
  if (!error) return "Ocorreu um erro inesperado. Tente novamente.";

  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (message.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  }
  if (message.includes("user not found")) {
    // Nunca chega ao usuário — tratado como sucesso genérico no fluxo de
    // recuperação de senha (ver forgot-password-form.tsx).
    return "E-mail ou senha incorretos.";
  }
  if (message.includes("rate limit") || error.status === 429) {
    return "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.";
  }
  if (message.includes("network")) {
    return "Não foi possível conectar. Verifique sua internet e tente novamente.";
  }
  if (message.includes("password")) {
    return "Senha inválida. Verifique os requisitos e tente novamente.";
  }

  return "Ocorreu um erro inesperado. Tente novamente em instantes.";
}
