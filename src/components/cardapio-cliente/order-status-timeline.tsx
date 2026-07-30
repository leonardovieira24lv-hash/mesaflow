import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import type { OrderStatus } from "@/types/domain";

/**
 * Sprint "Simplificação do Fluxo de Status" (2026-07-30): MesaFlow não é
 * delivery — quem leva o pedido até a mesa é o garçom, o cliente não
 * precisa acompanhar "Pronto" separado de "Entregue". Timeline reduzida de
 * 4 para 3 passos; os dois viraram um único "Finalizado".
 */
const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "pending", label: "Pedido realizado" },
  { status: "preparing", label: "Em preparo" },
  { status: "delivered", label: "Finalizado" },
];

/** Mesma máquina de estados do contrato 8.3 (`lib/orders/status-transitions.ts`), só a ordem linear para desenhar a timeline. */
const STEP_ORDER: OrderStatus[] = ["pending", "preparing", "delivered"];

/**
 * Timeline visual do pedido (Fase 5: "mostrar timeline/status visual do
 * pedido"). `cancelled` é tratado à parte — não é um passo a mais na linha,
 * é um desvio dela (contrato 8.3: cancelamento pode acontecer a partir de
 * qualquer estado não-terminal).
 *
 * `ready` (legado — nenhum pedido novo chega mais nele, ver
 * `order-status-transitions-map.ts`) é tratado como equivalente a
 * `preparing` aqui: um pedido antigo eventualmente parado em `ready` antes
 * desta mudança continua mostrando a timeline corretamente, sem virar um
 * 4º passo visível nem quebrar o cálculo do passo atual.
 */
export function OrderStatusTimeline({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return (
      <Alert variant="destructive" className="font-medium">
        Este pedido foi cancelado.
      </Alert>
    );
  }

  const effectiveStatus = status === "ready" ? "preparing" : status;
  const currentIndex = STEP_ORDER.indexOf(effectiveStatus);

  return (
    <div className="flex flex-col gap-4">
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

      {effectiveStatus === "delivered" && (
        <Alert variant="info" className="font-medium">
          Seu pedido foi finalizado e será servido em instantes.
        </Alert>
      )}
    </div>
  );
}
