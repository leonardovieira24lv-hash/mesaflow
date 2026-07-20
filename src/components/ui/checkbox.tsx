import { forwardRef, type InputHTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size">;

/**
 * Checkbox acessível: usa um <input type="checkbox"> real (nativamente
 * navegável por teclado e por leitor de tela), só visualmente escondido via
 * `peer` + um quadrado desenhado ao lado que reage a `:checked`/`:focus-visible`.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, id, ...props }, ref) => {
    return (
      <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className={cn("peer absolute inset-0 h-5 w-5 cursor-pointer opacity-0", className)}
          {...props}
        />
        <span
          className={cn(
            "pointer-events-none flex h-5 w-5 items-center justify-center rounded border border-border bg-surface",
            "transition-colors peer-checked:border-primary peer-checked:bg-primary",
            "peer-checked:[&>svg]:scale-100",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
            "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
          )}
        >
          <Check className="h-3.5 w-3.5 scale-0 text-primary-foreground transition-transform" />
        </span>
      </span>
    );
  },
);
Checkbox.displayName = "Checkbox";
