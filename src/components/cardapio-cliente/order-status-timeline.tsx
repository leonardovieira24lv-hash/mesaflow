import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import type { OrderStatus } from "@/types/domain";

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "pending", label: "Pedido recebido" },
  { status: "preparing", label: "Preparando" },
  { status: "ready", label: "Pronto" },
  { status: "delivered", label: "Entregue" },
];

/** Mesma máquina de estados do contrato 8.3 (`lib/orders/status-transitions.ts`), só a ordem linear para desenhar a timeline. */
const STEP_ORDER: OrderStatus[] = ["pending", "preparing", "ready", "delivered"];

/**
 * Timeline visual do pedido (Fase 5: "mostrar timeline/status visual do
 * pedido"). `cancelled` é tratado à parte — não é um passo a mais na linha,
 * é um desvio dela (contrato 8.3: cancelamento pode acontecer a partir de
 * qualquer estado não-terminal).
 */
export function OrderStatusTimeline({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return (
      <Alert variant="destructive" className="font-medium">
        Este pedido foi cancelado.
      </Alert>
    );
  }

  const currentIndex = STEP_ORDER.indexOf(status);

  return (
    <ol className="flex flex-col gap-4">
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <li key={step.status} className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                isDone && "border-success bg-success text-success-foreground",
                isCurrent && "border-primary bg-primary text-primary-foreground",
                !isDone && !isCurrent && "border-border bg-surface text-muted-foreground",
              )}
            >
              {isDone ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
            </span>
            <span className={cn("text-sm font-medium", isCurrent ? "text-foreground" : "text-muted-foreground")}>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
