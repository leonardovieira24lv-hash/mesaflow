import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Ativa hover com leve elevação/realce de borda — usar em cards que são também um link/botão (ex.: atalhos, itens clicáveis). Não afeta cards estáticos. */
  interactive?: boolean;
}

export function Card({ className, interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface text-surface-foreground shadow-card transition-shadow",
        interactive && "hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-card-hover transition-transform",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-6 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-display text-lg font-semibold leading-none", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-3 p-6 pt-0", className)} {...props} />;
}

/**
 * Divisor de "borda rasgada de comanda" — o elemento de assinatura do
 * design system. Usar com moderação: só dentro de cards que representem de
 * fato um pedido/comanda (ex.: separar itens do total), nunca como divisor
 * genérico de seção.
 */
export function CardTicketDivider({ className }: { className?: string }) {
  return <div className={cn("ticket-edge mx-6", className)} role="separator" />;
}
