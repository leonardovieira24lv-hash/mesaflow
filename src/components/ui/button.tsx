import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "link";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Mostra um spinner e desabilita o botão — usar durante submits assíncronos. */
  isLoading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "btn-primary-surface text-primary-foreground shadow-glow hover:brightness-110 active:brightness-95",
  secondary: "bg-muted text-foreground hover:bg-muted/70",
  outline: "border border-border bg-surface hover:border-primary/40 hover:bg-muted",
  ghost: "bg-transparent hover:bg-muted",
  destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow",
  link: "bg-transparent text-primary underline-offset-4 hover:underline",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10 shrink-0",
};

/**
 * Classes de um botão sem o elemento em si — usar quando o "botão" precisa
 * ser outro elemento (ex.: `<Link>` do Next.js, que não pode virar filho de
 * `<button>`). Prefira sempre `<Button>` quando um `<button>` de verdade
 * servir; isto existe só para esse caso específico de link estilizado como
 * botão (ver `ButtonLink` abaixo).
 */
export function buttonVariants(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium",
    "transition-[background-color,box-shadow,border-color,transform] duration-150",
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100",
    variantClasses[variant],
    sizeClasses[size],
  );
}

/**
 * Botão base do MesaFlow. Toda ação primária do produto usa `variant="primary"`
 * (Indigo) — reservar `destructive` só para exclusões/cancelamentos reais.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={cn(buttonVariants(variant, size), className)}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
