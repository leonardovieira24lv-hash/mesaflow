"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter, CardTicketDivider } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { OrderStatusBadge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { orderTrackingChannel } from "@/lib/realtime/channels";
import { getAvailableOrderStatusTransitions } from "@/lib/orders/order-status-transitions-map";
import { ROUTES } from "@/constants/routes";
import type { ApiError, ApiSuccess } from "@/types/api";
import type { OrderStatus } from "@/types/domain";

export interface OrderDetailDto {
  id: string;
  table: { id: string; name: string };
  status: OrderStatus;
  total_amount: number;
  notes?: string;
  items: { id: string; menu_item_id: string; name: string; price: number; quantity: number; notes?: string }[];
  created_at: string;
}

interface OrderDetailProps {
  initialOrder: OrderDetailDto;
}

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const STATUS_ACTION_LABELS: Record<OrderStatus, string> = {
  pending: "Marcar como pendente",
  preparing: "Iniciar preparo",
  ready: "Marcar como pronto",
  delivered: "Marcar como entregue",
  cancelled: "Cancelar pedido",
};

/**
 * Detalhes do Pedido (contrato seção 8.2/8.3, Sprint 10) — mesmo contexto
 * de `OrdersList`: o backend já existia completo desde a Sprint 8, só a
 * tela era um placeholder ("Módulo a implementar"), corrigido nesta
 * auditoria de qualidade.
 *
 * Se inscreve no canal `orders:id=eq.{id}` (Realtime) para refletir uma
 * mudança feita por outro atendente simultaneamente — carga inicial vem do
 * Server Component (página).
 */
export function OrderDetail({ initialOrder }: OrderDetailProps) {
  const [order, setOrder] = useState<OrderDetailDto>(initialOrder);
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(orderTrackingChannel(order.id))
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order.id}` },
        (payload) => {
          const next = payload.new as { status?: OrderStatus };
          if (next.status) {
            setOrder((prev) => ({ ...prev, status: next.status! }));
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [order.id]);

  const availableTransitions = getAvailableOrderStatusTransitions(order.status);

  async function applyStatusChange(nextStatus: OrderStatus) {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/v1/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = await response.json();

      if (!response.ok) {
        const apiError = body as ApiError;
        toast.error("Não foi possível atualizar o status", apiError.error?.message);
        setIsUpdating(false);
        setPendingStatus(null);
        return;
      }

      const success = body as ApiSuccess<{ status: OrderStatus }>;
      setOrder((prev) => ({ ...prev, status: success.data.status }));
      toast.success("Status atualizado");
      setIsUpdating(false);
      setPendingStatus(null);
    } catch {
      toast.error("Não foi possível conectar", "Verifique sua internet e tente novamente.");
      setIsUpdating(false);
      setPendingStatus(null);
    }
  }

  function handleTransitionClick(nextStatus: OrderStatus) {
    // Cancelar é destrutivo e não tem volta — pede confirmação. Os demais
    // avanços (preparing/ready/delivered) são o fluxo normal do dia a dia
    // de um atendente e não se beneficiam de uma confirmação extra a cada
    // clique.
    if (nextStatus === "cancelled") {
      setPendingStatus(nextStatus);
      return;
    }
    void applyStatusChange(nextStatus);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <ButtonLink href={ROUTES.pedidos} variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar para Pedidos
        </ButtonLink>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Mesa {order.table.name}</CardTitle>
            <CardDescription>
              Pedido criado em {dateTimeFormatter.format(new Date(order.created_at))}
            </CardDescription>
          </div>
          <OrderStatusBadge status={order.status} />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-0.5 rounded-lg border border-border bg-surface p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {item.quantity}× {item.name}
                  </span>
                  {item.notes && <span className="text-xs text-muted-foreground">{item.notes}</span>}
                </div>
                <span className="font-mono text-muted-foreground">{formatCurrency(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>

          {order.notes && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
              <span className="font-medium">Observações: </span>
              {order.notes}
            </div>
          )}
        </CardContent>

        <CardTicketDivider />

        <CardFooter className="justify-between">
          <span className="font-medium text-foreground">Total</span>
          <span className="font-mono text-lg font-semibold text-foreground">
            {formatCurrency(order.total_amount)}
          </span>
        </CardFooter>
      </Card>

      {availableTransitions.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {availableTransitions.map((next) => (
            <Button
              key={next}
              variant={next === "cancelled" ? "destructive" : "primary"}
              onClick={() => handleTransitionClick(next)}
              // O botão "Cancelar pedido" abre o `<ConfirmDialog>` (que tem
              // seu próprio spinner via `isConfirming`) em vez de aplicar a
              // mudança direto — não precisa do próprio estado de loading.
              isLoading={next !== "cancelled" && isUpdating}
              disabled={isUpdating}
            >
              {STATUS_ACTION_LABELS[next]}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Este pedido já está em um status final e não pode mais ser alterado.
        </p>
      )}

      <ConfirmDialog
        open={pendingStatus === "cancelled"}
        onOpenChange={(open) => !open && setPendingStatus(null)}
        title="Cancelar pedido"
        description={`O pedido da mesa ${order.table.name} será marcado como cancelado. Esta ação não pode ser desfeita.`}
        variant="destructive"
        confirmLabel="Sim, cancelar pedido"
        onConfirm={() => void applyStatusChange("cancelled")}
        isConfirming={isUpdating}
      />
    </div>
  );
}
