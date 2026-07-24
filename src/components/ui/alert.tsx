import type { HTMLAttributes } from "react";
import { AlertTriangle, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertVariant = "warning" | "destructive" | "info";

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  /** Esconde o ícone padrão — usar quando o conteúdo já traz o seu próprio (raro). */
  hideIcon?: boolean;
}

const VARIANT_CONFIG: Record<AlertVariant, { icon: typeof Info; className: string }> = {
  warning: { icon: AlertTriangle, className: "border-warning/30 bg-warning/5 text-warning" },
  destructive: { icon: XCircle, className: "border-destructive/30 bg-destructive/5 text-destructive" },
  info: { icon: Info, className: "border-info/30 bg-info/5 text-info" },
};
/**
 * Banner inline de aviso/erro reutilizável.
 * Centraliza o estilo dos avisos para evitar repetição de classes
 * entre Checkout, Timeline e Pedidos.
 */
export function Alert({ variant = "warning", hideIcon, className, children, ...props }: AlertProps) {
  const { icon: Icon, className: variantClassName } = VARIANT_CONFIG[variant];

  return (
    <div
      role="alert"
      className={cn("flex items-start gap-2.5 rounded-lg border p-4 text-sm", variantClassName, className)}
      {...props}
    >
      {!hideIcon && <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
      <div className="flex-1">{children}</div>
    </div>
  );
}
