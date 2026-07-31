import { AlertTriangle } from "lucide-react";

/**
 * Erro inline de uma seção do Dashboard — cada widget (cards, checklist,
 * pedidos) busca seus próprios dados de forma independente (Suspense por
 * seção); se uma consulta falhar, só aquela seção mostra isto, as outras
 * continuam funcionando normalmente.
 */
export function SectionError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-ds2-sm border border-dashed border-ds2-warning/30 bg-ds2-warning/5 p-4 text-sm text-ds2-foreground-muted">
      <AlertTriangle className="h-4 w-4 shrink-0 text-ds2-warning" aria-hidden />
      {message}
    </div>
  );
}
