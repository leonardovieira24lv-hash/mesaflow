/**
 * Shell centralizado para telas de autenticação/onboarding (sem sidebar).
 * A largura máxima é decidida por cada página/formulário (ex.: formulários
 * de login usam `max-w-md`, a revisão de QR Codes do onboarding usa
 * `max-w-2xl`) — este shell só centraliza, nunca restringe a largura.
 *
 * Etapa 2 — Redesign do Login (2026-08-12): `bg-muted/30` (cinza-escuro
 * translúcido, herdado de antes do rebrand Forko) virou `bg-muted` sólido
 * — token já existente (`220 14% 96%`, um off-white bem sutil, perto do
 * `#F8F9FA` pedido no briefing), sem inventar hex novo. Compartilhado por
 * Login/Cadastro/Recuperar Senha — mudar só o tom de fundo (sem tocar
 * estrutura/lógica) não deveria alterar a aparência dessas outras telas
 * de forma indesejada, já que nenhuma delas tinha um visual "escuro"
 * assumido: todas já usavam tokens claros por padrão.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-6">
      {children}
    </div>
  );
}
