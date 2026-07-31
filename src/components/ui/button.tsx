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

/**
 * `primary` não depende de `.btn-primary-surface` (classe em `globals.css`)
 * — usa tokens `ds2-*` diretamente, sempre verde, independente de tema.
 *
 * A classe `.btn-primary-surface` em si continua existindo em
 * `globals.css` — usada só por `menu-item-card.tsx` (Cardápio do cliente,
 * público, fora do escopo administrativo).
 */
const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-ds2-primary text-ds2-primary-foreground shadow-ds2-sm hover:shadow-ds2-md hover:brightness-110 active:brightness-95",
  secondary: "bg-ds2-surface-hover text-ds2-foreground hover:bg-ds2-surface-hover/70",
  outline: "border border-ds2-border bg-ds2-surface hover:border-ds2-primary/40 hover:bg-ds2-surface-hover",
  ghost: "bg-transparent hover:bg-ds2-surface-hover",
  destructive: "bg-ds2-danger text-ds2-danger-foreground shadow-ds2-sm hover:bg-ds2-danger/90 hover:shadow-ds2-md",
  link: "bg-transparent text-ds2-primary underline-offset-4 hover:underline",
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
 * botão (ver `ButtonLink`).
 *
 * `focus-visible` nativo aqui — `ButtonLink` reaproveita esta função,
 * então ganha o anel de foco junto, sem precisar de nenhuma mudança
 * própria. Onde algum `className` local ainda aplica um anel de foco por
 * fora (`focusRingClass` em Mesas/Dashboard/etc.), o resultado é
 * redundante, não incorreto.
 */
export function buttonVariants(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-ds2-sm font-medium",
    "transition-[background-color,box-shadow,border-color,transform] duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds2-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ds2-background",
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100",
    variantClasses[variant],
    sizeClasses[size],
  );
}

/**
 * Botão base do MesaFlow. Toda ação primária do produto usa `variant="primary"`
 * (verde, única cor de marca da DS2) — reservar `destructive` só para
 * exclusões/cancelamentos reais.
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
