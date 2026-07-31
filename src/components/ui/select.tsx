import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputInvalidClasses } from "@/components/ui/input";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

/**
 * Select nativo estilizado (não um combobox customizado) — garante
 * comportamento de acessibilidade e teclado corretos "de graça" em todos os
 * navegadores e leitores de tela, sem reimplementar um listbox do zero.
 *
 * Mesma base de `Input` (hover, focus-visible com anel, disabled) — sem
 * estado `readonly` de propósito: o HTML nativo de `<select>` não suporta
 * o atributo `readonly` de forma útil (só `disabled`). Se um dia for
 * necessário um "select somente leitura" de verdade, a solução é um
 * componente próprio (combobox/listbox custom), não forçar o nativo.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn(
            "h-10 w-full appearance-none rounded-ds2-sm border border-ds2-border bg-ds2-surface pl-3 pr-9 text-sm text-ds2-foreground",
            "transition-colors hover:border-ds2-primary/40",
            "focus-visible:outline-none focus-visible:border-ds2-primary focus-visible:ring-2 focus-visible:ring-ds2-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ds2-background",
            "disabled:cursor-not-allowed disabled:border-ds2-border disabled:bg-ds2-surface-hover disabled:opacity-60 disabled:hover:border-ds2-border",
            invalid && inputInvalidClasses,
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds2-foreground-muted"
          aria-hidden
        />
      </div>
    );
  },
);
Select.displayName = "Select";
