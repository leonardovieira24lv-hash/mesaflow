import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Paginação puramente apresentacional — recebe `page`/`totalPages` prontos
 * (do `meta` do envelope de resposta, seção 1.3 do contrato) e só notifica
 * `onPageChange`; quem decide como buscar a próxima página é o módulo que
 * usa este componente, nunca ele mesmo.
 */
export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <nav
      aria-label="Paginação"
      className={cn("flex items-center justify-between gap-4", className)}
    >
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Página anterior"
      >
        <ChevronLeft className="h-4 w-4" />
        Anterior
      </Button>

      <ul className="flex items-center gap-1">
        {pageNumbers.map((p, i) =>
          p === "..." ? (
            <li key={`ellipsis-${i}`} className="px-2 text-sm text-muted-foreground">
              …
            </li>
          ) : (
            <li key={p}>
              <button
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors",
                  p === page
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {p}
              </button>
            </li>
          ),
        )}
      </ul>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Próxima página"
      >
        Próxima
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}

/** Gera a lista de páginas com reticências (ex.: 1 … 4 5 [6] 7 8 … 20). */
function getPageNumbers(page: number, totalPages: number): (number | "...")[] {
  const delta = 1;
  const range: (number | "...")[] = [];
  const rangeStart = Math.max(2, page - delta);
  const rangeEnd = Math.min(totalPages - 1, page + delta);

  range.push(1);
  if (rangeStart > 2) range.push("...");
  for (let i = rangeStart; i <= rangeEnd; i++) range.push(i);
  if (rangeEnd < totalPages - 1) range.push("...");
  if (totalPages > 1) range.push(totalPages);

  return range;
}
