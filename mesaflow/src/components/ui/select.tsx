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
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn(
            "h-10 w-full appearance-none rounded-md border border-border bg-surface pl-3 pr-9 text-sm text-surface-foreground",
            "transition-colors focus-visible:border-primary",
            "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
            invalid && inputInvalidClasses,
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      </div>
    );
  },
);
Select.displayName = "Select";
