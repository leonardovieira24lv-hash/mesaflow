import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { OrderStatus, TableStatus } from "@/types/domain";

type Variant = "default" | "success" | "warning" | "destructive" | "info" | "muted";

const variantClasses: Record<Variant, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  muted: "bg-muted text-muted-foreground",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

/** Badge genérico. Para status de domínio (pedido/mesa), preferir os wrappers abaixo. */
export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

const ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; variant: Variant }> = {
  pending: { label: "Pendente", variant: "muted" },
  preparing: { label: "Preparando", variant: "warning" },
  ready: { label: "Pronto", variant: "success" },
  delivered: { label: "Entregue", variant: "info" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

/** Badge com rótulo e cor já resolvidos a partir do status de pedido (contrato seção 8.3). */
export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const config = ORDER_STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}

const TABLE_STATUS_CONFIG: Record<TableStatus, { label: string; variant: Variant }> = {
  livre: { label: "Livre", variant: "success" },
  ocupada: { label: "Ocupada", variant: "warning" },
  manutencao: { label: "Manutenção", variant: "muted" },
};

/** Badge com rótulo e cor já resolvidos a partir do status de mesa (contrato seção 7.3). */
export function TableStatusBadge({ status, className }: { status: TableStatus; className?: string }) {
  const config = TABLE_STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
