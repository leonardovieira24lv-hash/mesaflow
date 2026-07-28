import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Marca o campo com estado de erro (borda + anel destrutivos). Combinar com FormField para a mensagem. */
  invalid?: boolean;
  /** Ícone opcional à esquerda (ex.: lucide-react), decorativo. */
  leadingIcon?: ReactNode;
  /** Ícone/elemento opcional à direita (ex.: toggle de senha). */
  trailingIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, leadingIcon, trailingIcon, ...props }, ref) => {
    if (!leadingIcon && !trailingIcon) {
      return (
        <input
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn(inputBaseClasses, invalid && inputInvalidClasses, className)}
          {...props}
        />
      );
    }

    return (
      <div className="relative flex items-center">
        {leadingIcon && (
          <span className="pointer-events-none absolute left-3 flex text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn(
            inputBaseClasses,
            invalid && inputInvalidClasses,
            leadingIcon && "pl-9",
            trailingIcon && "pr-9",
            className,
          )}
          {...props}
        />
        {trailingIcon && (
          <span className="absolute right-3 flex text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">
            {trailingIcon}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export const inputBaseClasses = cn(
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-surface-foreground",
  "placeholder:text-muted-foreground",
  "transition-colors focus-visible:border-primary",
  "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
);

export const inputInvalidClasses = "border-destructive focus-visible:ring-destructive";
