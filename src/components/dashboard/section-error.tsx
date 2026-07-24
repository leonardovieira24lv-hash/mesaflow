import { AlertTriangle } from "lucide-react";

/**
 * Erro inline de uma seção do Dashboard — cada widget (cards, checklist,
 * pedidos) busca seus próprios dados de forma independente (Suspense por
 * seção); se uma consulta falhar, só aquela seção mostra isto, as outras
 * continuam funcionando normalmente.
 */
export function SectionError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-warning/30 bg-warning/5 p-4 text-sm text-muted-foreground">
      <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden />
      {message}
    </div>
  );
}
