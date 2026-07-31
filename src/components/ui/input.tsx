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
          <span className="pointer-events-none absolute left-3 flex text-ds2-foreground-muted [&>svg]:h-4 [&>svg]:w-4">
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
          <span className="absolute right-3 flex text-ds2-foreground-muted [&>svg]:h-4 [&>svg]:w-4">
            {trailingIcon}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

/**
 * `Select` e `Textarea` importam `inputBaseClasses`/`inputInvalidClasses`
 * daqui — editar aqui já propaga para os três.
 *
 * - **Hover**: `hover:border-ds2-primary/40`.
 * - **Focus-visible**: `focus-visible:ring-2 ring-ds2-ring`, além da
 *   mudança de cor de borda.
 * - **Readonly**: `read-only:` (pseudo-classe nativa do CSS) — fundo
 *   `ds2-surface-hover` e cursor `default`, **sem** reduzir opacidade —
 *   de propósito, para não parecer `disabled`. O campo continua com o
 *   mesmo texto legível/selecionável de sempre, só sinaliza "isto não
 *   pode ser editado" por um fundo discretamente diferente, não por
 *   aparência "apagada".
 */
export const inputBaseClasses = cn(
  "h-10 w-full rounded-ds2-sm border border-ds2-border bg-ds2-surface px-3 text-sm text-ds2-foreground",
  "placeholder:text-ds2-foreground-muted",
  "transition-colors hover:border-ds2-primary/40",
  "focus-visible:outline-none focus-visible:border-ds2-primary focus-visible:ring-2 focus-visible:ring-ds2-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ds2-background",
  "read-only:cursor-default read-only:border-ds2-border read-only:bg-ds2-surface-hover read-only:hover:border-ds2-border",
  "disabled:cursor-not-allowed disabled:border-ds2-border disabled:bg-ds2-surface-hover disabled:opacity-60 disabled:hover:border-ds2-border",
);

export const inputInvalidClasses = "border-ds2-danger hover:border-ds2-danger focus-visible:border-ds2-danger focus-visible:ring-ds2-danger";
