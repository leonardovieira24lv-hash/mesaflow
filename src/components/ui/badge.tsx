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

// Sprint "Simplificação do Fluxo de Status" (2026-07-30): MesaFlow não é
// delivery, o garçom leva o pedido até a mesa — "Pronto"/"Entregue" viram
// um único "Finalizado". `ready` continua precisando de uma entrada aqui
// (o `Record` cobre todo `OrderStatus`), mas nenhum pedido novo chega
// nesse status (ver `order-status-transitions-map.ts`) — a entrada existe
// só para não quebrar a tipagem caso um pedido antigo, parado em `ready`
// antes desta mudança, ainda apareça em algum lugar; ela usa o mesmo
// rótulo/cor de `preparing` de propósito, para nunca aparecer como um 4º
// estado visível na interface.
const ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; variant: Variant }> = {
  pending: { label: "Pedido realizado", variant: "muted" },
  preparing: { label: "Em preparo", variant: "warning" },
  ready: { label: "Em preparo", variant: "warning" },
  delivered: { label: "Finalizado", variant: "info" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

/**
 * Badge com rótulo e cor já resolvidos a partir do status de pedido
 * (contrato seção 8.3). Usado tanto no painel administrativo quanto na
 * tela pública de acompanhamento do cliente (`order-tracking-view.tsx`) —
 * por isso as cores aqui **não** seguem a paleta do Dark Theme Premium
 * (essa tela do cliente continua no tema claro original). Para o painel
 * administrativo, usar `AdminOrderStatusBadge` abaixo.
 */
export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const config = ORDER_STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} dot className={className}>
      {config.label}
    </Badge>
  );
}

/**
 * Sprint "Dark Theme Premium": versão só para o painel administrativo, com
 * a paleta de status pedida no briefing (Preparando=azul, Pronto=verde,
 * Cancelado=vermelho) — mantida separada de `OrderStatusBadge` de propósito,
 * para não mudar a cor de status na tela pública de acompanhamento do
 * cliente, que está fora do escopo desta sprint (só o painel admin).
 */
const ADMIN_ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; variant: Variant }> = {
  pending: { label: "Pedido realizado", variant: "muted" },
  preparing: { label: "Em preparo", variant: "info" },
  ready: { label: "Em preparo", variant: "info" },
  delivered: { label: "Finalizado", variant: "muted" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

export function AdminOrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const config = ADMIN_ORDER_STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} dot className={className}>
      {config.label}
    </Badge>
  );
}

const TABLE_STATUS_CONFIG: Record<TableStatus, { label: string; variant: Variant }> = {
  livre: { label: "Livre", variant: "muted" },
  ocupada: { label: "Ocupada", variant: "default" },
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
