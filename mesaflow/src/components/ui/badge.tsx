import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { OrderStatus, RestaurantStatus, TableStatus } from "@/types/domain";

type Variant = "default" | "success" | "warning" | "destructive" | "info" | "muted";

const variantClasses: Record<Variant, string> = {
  default: "bg-primary/10 text-primary ring-1 ring-inset ring-primary/15",
  success: "bg-success/10 text-success ring-1 ring-inset ring-success/15",
  warning: "bg-warning/10 text-warning ring-1 ring-inset ring-warning/15",
  destructive: "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/15",
  info: "bg-info/10 text-info ring-1 ring-inset ring-info/15",
  muted: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  /** Mostra um ponto indicador antes do texto — usar para status "ao vivo" (pedido, mesa). */
  dot?: boolean;
}

const dotColorClasses: Record<Variant, string> = {
  default: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
  muted: "bg-muted-foreground",
};

/** Badge genérico. Para status de domínio (pedido/mesa), preferir os wrappers abaixo. */
export function Badge({ className, variant = "default", dot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotColorClasses[variant])} aria-hidden />}
      {children}
    </span>
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
    <Badge variant={config.variant} dot className={className}>
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
    <Badge variant={config.variant} dot className={className}>
      {config.label}
    </Badge>
  );
}

const RESTAURANT_STATUS_CONFIG: Record<RestaurantStatus, { label: string; variant: Variant }> = {
  onboarding: { label: "Em configuração", variant: "warning" },
  active: { label: "Ativo", variant: "success" },
};

/** Badge com rótulo e cor já resolvidos a partir do status do restaurante (contrato seção 4.1). */
export function RestaurantStatusBadge({
  status,
  className,
}: {
  status: RestaurantStatus;
  className?: string;
}) {
  const config = RESTAURANT_STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
