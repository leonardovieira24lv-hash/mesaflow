import type { HTMLAttributes } from "react";
import { AlertTriangle, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertVariant = "warning" | "destructive" | "info";

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  /** Esconde o ícone padrão — usar quando o conteúdo já traz o seu próprio (raro). */
  hideIcon?: boolean;
}

/**
 * Sem variante `success`, de propósito — não foi aprovada como variante
 * nova; não criar por conta própria.
 */
const VARIANT_CONFIG: Record<AlertVariant, { icon: typeof Info; className: string }> = {
  warning: { icon: AlertTriangle, className: "border-ds2-warning/30 bg-ds2-warning/5 text-ds2-warning" },
  destructive: { icon: XCircle, className: "border-ds2-danger/30 bg-ds2-danger/5 text-ds2-danger" },
  info: { icon: Info, className: "border-ds2-info/30 bg-ds2-info/5 text-ds2-info" },
};

/**
 * Banner inline de aviso/erro — extraído na Sprint 12 a partir de 5
 * ocorrências quase idênticas espalhadas entre Checkout, Timeline de
 * pedido e listagem de Pedidos (cada uma com a mesma combinação de
 * classes repetida à mão: borda, fundo e texto na cor da variante).
 * Usar aqui em vez de remontar essas classes soltas.
 */
export function Alert({ variant = "warning", hideIcon, className, children, ...props }: AlertProps) {
  const { icon: Icon, className: variantClassName } = VARIANT_CONFIG[variant];

  return (
    <div
      role="alert"
      className={cn("flex items-start gap-2.5 rounded-ds2-md border p-4 text-sm", variantClassName, className)}
      {...props}
    >
      {!hideIcon && <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
      <div className="flex-1">{children}</div>
    </div>
  );
}
