/**
 * Shell centralizado para telas de autenticação/onboarding (sem sidebar).
 * A largura máxima é decidida por cada página/formulário (ex.: formulários
 * de login usam `max-w-md`, a revisão de QR Codes do onboarding usa
 * `max-w-2xl`) — este shell só centraliza, nunca restringe a largura.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      {children}
    </div>
  );
}
