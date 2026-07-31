import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { OrderStatus, RestaurantStatus, TableStatus } from "@/types/domain";

type Variant = "default" | "success" | "warning" | "destructive" | "info" | "muted";

/**
 * Tokens do MesaFlow Visual Language v1.0. API: 6 `variant`, prop `dot`.
 * O nome da variante `destructive` foi mantido (usado por 10
 * consumidores) mesmo a cor por trás sendo `ds2-danger` — é a
 * nomenclatura oficial (seção 7) para "vermelho/urgência".
 */
const variantClasses: Record<Variant, string> = {
  default: "bg-ds2-primary/10 text-ds2-primary ring-1 ring-inset ring-ds2-primary/15",
  success: "bg-ds2-success/10 text-ds2-success ring-1 ring-inset ring-ds2-success/15",
  warning: "bg-ds2-warning/10 text-ds2-warning ring-1 ring-inset ring-ds2-warning/15",
  destructive: "bg-ds2-danger/10 text-ds2-danger ring-1 ring-inset ring-ds2-danger/15",
  info: "bg-ds2-info/10 text-ds2-info ring-1 ring-inset ring-ds2-info/15",
  muted: "bg-ds2-surface-hover text-ds2-foreground-muted ring-1 ring-inset ring-ds2-border",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  /** Mostra um ponto indicador antes do texto — usar para status "ao vivo" (pedido, mesa). */
  dot?: boolean;
}

const dotColorClasses: Record<Variant, string> = {
  default: "bg-ds2-primary",
  success: "bg-ds2-success",
  warning: "bg-ds2-warning",
  destructive: "bg-ds2-danger",
  info: "bg-ds2-info",
  muted: "bg-ds2-foreground-muted",
};

/** Badge genérico. Para status de domínio (pedido/mesa/restaurante), preferir os wrappers abaixo. */
export function Badge({ className, variant = "default", dot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-ds2-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-ds2-full", dotColorClasses[variant])} aria-hidden />}
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
 * por isso as cores aqui **não** seguem a DS2 (essa tela do cliente
 * continua no tema claro original, fora do escopo de todas as sprints
 * UI-0x até aqui). Para o painel administrativo, usar `AdminOrderStatusBadge`
 * abaixo.
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
 * Versão só para o painel administrativo, com a paleta de status própria
 * (Preparando=azul, Pronto=verde, Cancelado=vermelho) — mantida separada
 * de `OrderStatusBadge` de propósito, para não mudar a cor de status na
 * tela pública de acompanhamento do cliente.
 *
 * A arquitetura de um wrapper por domínio de status (`OrderStatusBadge`/
 * `AdminOrderStatusBadge`/`TableStatusBadge`/`RestaurantStatusBadge`)
 * continua adequada — a duplicação entre os 4 é só a forma do `Record`,
 * não lógica; consolidar numa função genérica (`createStatusBadge(config)`)
 * só compensaria com um 5º/6º wrapper.
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

/**
 * Nenhum consumidor usa este componente hoje — o Painel de Mesas nunca
 * dependeu dele, construiu seu próprio sistema de tom
 * (`deriveTableCardState`). Registrado como código sem uso, mantido de
 * propósito até uma sprint exclusiva de limpeza.
 */
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

/**
 * Única fonte de verdade para o texto de status do restaurante —
 * `restaurant-status-header.tsx` (Dashboard) já consulta este componente
 * em vez de manter um mapa de rótulos próprio.
 */
const RESTAURANT_STATUS_CONFIG: Record<RestaurantStatus, { label: string; variant: Variant }> = {
  onboarding: { label: "Ainda configurando", variant: "warning" },
  active: { label: "Recebendo pedidos", variant: "success" },
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
    <Badge variant={config.variant} dot className={className}>
      {config.label}
    </Badge>
  );
}
