import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Ativa hover com leve elevação/realce de borda — usar em cards que são também um link/botão (ex.: atalhos, itens clicáveis). Não afeta cards estáticos. */
  interactive?: boolean;
}

/**
 * Tokens do MesaFlow Visual Language v1.0 — superfície "Elevada" (seção
 * 3): `shadow-ds2-sm`, `ds2-radius-md`. Padding `p-4 sm:p-5` (seção 5).
 *
 * Nenhuma variante nova (`elevated` etc.) — o Visual Language só cria
 * variante quando resolve um problema recorrente já consolidado, e essa
 * necessidade ainda não está.
 */
export function Card({ className, interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-ds2-md border border-ds2-border bg-ds2-surface text-ds2-foreground shadow-ds2-sm transition-shadow",
        interactive && "transition-transform hover:-translate-y-0.5 hover:border-ds2-primary/30 hover:shadow-ds2-md",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-4 pb-3 sm:p-5 sm:pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-display text-lg font-semibold leading-none text-ds2-foreground", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-ds2-foreground-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-0 sm:p-5 sm:pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-3 p-4 pt-0 sm:p-5 sm:pt-0", className)} {...props} />;
}

/** Divisor horizontal simples dentro de um card (ex.: separar itens do total). */
export function CardDivider({ className }: { className?: string }) {
  return <div className={cn("mx-4 border-t border-ds2-border sm:mx-5", className)} role="separator" />;
}
