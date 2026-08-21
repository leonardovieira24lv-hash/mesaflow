"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter, CardDivider } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminOrderStatusBadge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { orderTrackingChannel } from "@/lib/realtime/channels";
import { getAvailableOrderStatusTransitions } from "@/lib/orders/order-status-transitions-map";
import type { ApiError, ApiSuccess } from "@/types/api";
import type { OrderStatus } from "@/types/domain";

export interface OrderDetailDto {
  id: string;
  table: { id: string; name: string };
  status: OrderStatus;
  total_amount: number;
  notes?: string;
  items: {
    id: string;
    menu_item_id: string | null;
    name: string;
    price: number;
    quantity: number;
    notes?: string;
    cancelled_at: string | null;
    // Sistema de Opcionais, Fase 1/3, Passo 4 (2026-08-15) — gap
    // encontrado: esta página nunca buscava/exibia isto, mesmo já
    // existindo desde a Fase 1. Corrigido junto com o relato do dono
    // sobre `half_and_half` faltando aqui.
    selected_options?: { group_name: string; option_name: string; price_delta: number }[];
    half_and_half?: { flavor_a_name: string; flavor_a_price: number; flavor_b_name: string; flavor_b_price: number };
  }[];
  created_at: string;
}

interface OrderDetailProps {
  initialOrder: OrderDetailDto;
  /**
   * Correção (2026-08-15) — outros pedidos da MESMA comanda (mesmo
   * `order_session_id`), exibidos read-only abaixo do pedido principal.
   * Resolve o link "Ver histórico completo de pedidos desta mesa"
   * (plural) realmente mostrar todos, não só 1.
   */
  siblingOrders: OrderDetailDto[];
  /** Quando aberto pelo histórico da mesa, a tela é somente consulta. */
  readOnly?: boolean;
}

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

// Sprint "Simplificação do Fluxo de Status" (2026-07-30): `preparing` agora
// vai direto pra `delivered` (ver `order-status-transitions-map.ts`) — o
// rótulo de `ready` continua aqui só porque `Record<OrderStatus, string>`
// exige todas as chaves; na prática, nenhuma transição leva mais até
// `ready`, então este botão nunca aparece pra um pedido novo (só apareceria
// para um pedido legado que já estivesse parado em `ready` antes desta
// mudança, decidindo ele mesmo ir para `delivered`/`cancelled`).
const STATUS_ACTION_LABELS: Record<OrderStatus, string> = {
  pending: "Marcar como pendente",
  preparing: "Iniciar preparo",
  ready: "Marcar como pronto",
  delivered: "Marcar como finalizado",
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
export function OrderDetail({ initialOrder, siblingOrders, readOnly = false }: OrderDetailProps) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetailDto>(initialOrder);
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  // Trava síncrona (além de `isUpdating`) — `setState` só reflete no DOM
  // (e no `disabled` do botão) no próximo render, então um duplo toque bem
  // rápido no touchscreen podia disparar duas requisições antes do botão
  // desabilitar de verdade. Uma ref muda na hora, sem esperar re-render.
  const isSubmittingRef = useRef(false);

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

  /**
   * Sprint de Correção de Regressões Críticas — Bug 2 ("falso conflito" ao
   * mudar status). A checagem de concorrência otimista em si
   * (`orders/[id]/status/route.ts`, Sprint 4 de Correção) está correta —
   * ela só rejeita quando o status no banco já não é mais o que a tela
   * mostrava. A causa real do "falso conflito" relatado é a tela ficar
   * comparando contra um `order.status` desatualizado quando o mesmo pedido
   * já foi avançado por outro caminho (ex.: "Enviar para cozinha" no Drawer
   * de Mesas, que chama este mesmo endpoint) sem esta tela ter recebido a
   * atualização a tempo — o clique parece "do nada" falhar para quem está
   * vendo só esta tela. Duas correções, nenhuma toca a máquina de estados:
   *
   *  1. Guarda contra clique duplo antes mesmo do primeiro `await`
   *     (`isUpdating` só vira `true` de fato depois de um render — um
   *     duplo clique bem rápido podia dar tempo de disparar duas
   *     requisições antes do botão desabilitar de verdade).
   *  2. Em vez de só mostrar um erro genérico e deixar a tela travada
   *     mostrando um botão que vai falhar de novo, busca o estado real
   *     atual do pedido (`GET /api/v1/orders/{id}`) e atualiza a tela — os
   *     botões disponíveis recalculam sozinhos a partir do status
   *     verdadeiro, então a pessoa vê o que realmente aconteceu em vez de
   *     ficar presa num conflito que não entende.
   */
  async function applyStatusChange(nextStatus: OrderStatus) {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

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

        if (apiError.error?.code === "CONFLICT") {
          await resyncOrder();
          toast.error(
            "O pedido já tinha sido atualizado",
            "A tela foi atualizada com o status mais recente — confira antes de tentar de novo.",
          );
        } else {
          toast.error("Não foi possível atualizar o status", apiError.error?.message);
        }

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
    } finally {
      isSubmittingRef.current = false;
    }
  }

  /** Rebusca o pedido para resincronizar a tela após um conflito de status (ver `applyStatusChange`). */
  async function resyncOrder() {
    try {
      const response = await fetch(`/api/v1/orders/${order.id}`);
      const body = await response.json();
      if (response.ok) {
        const success = body as ApiSuccess<OrderDetailDto>;
        setOrder(success.data);
      }
    } catch {
      // Melhor esforço — se isto falhar também, a assinatura Realtime já
      // ativa (linha ~63) deve alcançar o estado correto em breve.
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
        {/* Corrigido a pedido do dono (2026-08-15): antes ia sempre pra
            lista de Pedidos (`ROUTES.pedidos`), mesmo quando a pessoa
            chegou aqui a partir do drawer de Mesas ("Ver histórico
            completo de pedidos desta mesa") — "voltar" levava pra um
            lugar sem relação com de onde ela veio. `router.back()` volta
            pra tela anterior de verdade, seja Mesas ou Pedidos. */}
        <Button type="button" variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Mesa {order.table.name}</CardTitle>
            <CardDescription>
              Pedido criado em {dateTimeFormatter.format(new Date(order.created_at))}
            </CardDescription>
          </div>
          <AdminOrderStatusBadge status={order.status} />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-0.5 rounded-ds2-sm border border-ds2-border bg-ds2-surface p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col">
                  <span
                    className={cn(
                      "font-medium",
                      item.cancelled_at ? "text-ds2-foreground-muted line-through" : "text-ds2-foreground",
                    )}
                  >
                    {item.quantity}×{" "}
                    {item.half_and_half
                      ? `Meio a meio: ${item.half_and_half.flavor_a_name} / ${item.half_and_half.flavor_b_name}`
                      : item.name}
                  </span>
                  {item.selected_options && item.selected_options.length > 0 && (
                    <span className="text-xs text-ds2-foreground-muted">
                      {item.selected_options.map((o) => `${o.group_name}: ${o.option_name}`).join(", ")}
                    </span>
                  )}
                  {item.notes && <span className="text-xs text-ds2-foreground-muted">{item.notes}</span>}
                </div>
                {item.cancelled_at ? (
                  <span className="shrink-0 text-xs font-medium text-ds2-danger">Cancelado</span>
                ) : (
                  <span className="font-numeric text-ds2-foreground-muted">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                )}
              </li>
            ))}
          </ul>

          {order.notes && (
            <div className="rounded-ds2-sm border border-ds2-border bg-ds2-surface-hover/40 p-3 text-sm text-ds2-foreground">
              <span className="font-medium">Observações: </span>
              {order.notes}
            </div>
          )}
        </CardContent>

        <CardDivider />

        <CardFooter className="justify-between">
          <span className="font-medium text-ds2-foreground">Total</span>
          <span className="font-numeric text-lg font-semibold text-ds2-foreground">
            {formatCurrency(order.total_amount)}
          </span>
        </CardFooter>
      </Card>

      {/* Correção (2026-08-15): outros pedidos da mesma comanda —
          read-only de propósito (sem botão de ação), pra não duplicar a
          máquina de transição de status inteira aqui dentro; mudar
          status de um pedido específico continua sendo feito no drawer
          de Mesas ou clicando nele direto na lista de Pedidos. */}
      {siblingOrders.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-ds2-foreground-muted">
            Outros pedidos desta comanda ({siblingOrders.length})
          </h2>
          {siblingOrders.map((sibling) => (
            <Card key={sibling.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-4 py-3">
                <CardDescription>
                  Pedido criado em {dateTimeFormatter.format(new Date(sibling.created_at))}
                </CardDescription>
                <AdminOrderStatusBadge status={sibling.status} />
              </CardHeader>
              <CardContent className="flex flex-col gap-2 pt-0">
                <ul className="flex flex-col gap-2">
                  {sibling.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col gap-0.5 rounded-ds2-sm border border-ds2-border bg-ds2-surface p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex flex-col">
                        <span
                          className={cn(
                            "font-medium",
                            item.cancelled_at ? "text-ds2-foreground-muted line-through" : "text-ds2-foreground",
                          )}
                        >
                          {item.quantity}×{" "}
                          {item.half_and_half
                            ? `Meio a meio: ${item.half_and_half.flavor_a_name} / ${item.half_and_half.flavor_b_name}`
                            : item.name}
                        </span>
                        {item.selected_options && item.selected_options.length > 0 && (
                          <span className="text-xs text-ds2-foreground-muted">
                            {item.selected_options.map((o) => `${o.group_name}: ${o.option_name}`).join(", ")}
                          </span>
                        )}
                        {item.notes && <span className="text-xs text-ds2-foreground-muted">{item.notes}</span>}
                      </div>
                      {item.cancelled_at ? (
                        <span className="shrink-0 text-xs font-medium text-ds2-danger">Cancelado</span>
                      ) : (
                        <span className="font-numeric text-ds2-foreground-muted">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardDivider />
              <CardFooter className="justify-between">
                <span className="font-medium text-ds2-foreground">Total</span>
                <span className="font-numeric text-lg font-semibold text-ds2-foreground">
                  {formatCurrency(sibling.total_amount)}
                </span>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {!readOnly && (
        <>
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
            <p className="text-sm text-ds2-foreground-muted">
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
        </>
      )}
    </div>
  );
}
