"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { OrderStatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Pagination } from "@/components/ui/pagination";
import { SkeletonTableRow } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { restaurantOrdersChannel } from "@/lib/realtime/channels";
import { ROUTES } from "@/constants/routes";
import type { ApiSuccess } from "@/types/api";
import type { OrderStatus } from "@/types/domain";

export interface OrderListRow {
  id: string;
  table: { id: string; name: string };
  status: OrderStatus;
  total_amount: number;
  item_count: number;
  created_at: string;
}

interface OrdersListProps {
  restaurantId: string;
  initialOrders: OrderListRow[];
  initialMeta: { page: number; per_page: number; total: number; total_pages: number };
}

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

// Contrato 8.1 não define uma ordem própria para os filtros — segue a mesma
// ordem da máquina de estados (pending → preparing → ready → delivered),
// com "cancelled" por último por ser o desvio da linha principal.
const STATUS_FILTERS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendentes" },
  { value: "preparing", label: "Preparando" },
  { value: "ready", label: "Prontos" },
  { value: "delivered", label: "Entregues" },
  { value: "cancelled", label: "Cancelados" },
];

/**
 * Painel de Pedidos em Tempo Real (contrato seção 8.1, Sprint 10).
 *
 * Substitui o placeholder que sobrou da Sprint 8: o backend
 * (`GET /api/v1/orders`, `lib/orders/status-transitions.ts`, a migration
 * 0007 e o helper `restaurantOrdersChannel`) já existia completo e
 * documentado, só a tela em si nunca tinha sido construída — encontrado e
 * corrigido durante a auditoria de qualidade desta sprint (não é uma
 * funcionalidade nova da v1.1, é o fechamento de um módulo que já constava
 * como concluído).
 *
 * Carga inicial vem do Server Component (página); atualizações seguintes
 * chegam via Supabase Realtime no canal `restaurant:{id}:orders`
 * (`postgres_changes` em `orders`) — sem polling, como o comentário
 * original de `api/v1/orders/route.ts` já previa. Isso é seguro aqui (ao
 * contrário da Área do Cliente pública, ver nota em `order-tracking-view.tsx`)
 * porque esta tela só existe atrás de `requireSession()`/RLS: o usuário
 * autenticado só recebe eventos de pedidos do próprio restaurante
 * (`select_own_orders`, RLS por `auth.uid()`).
 */
export function OrdersList({ restaurantId, initialOrders, initialMeta }: OrdersListProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderListRow[]>(initialOrders);
  const [meta, setMeta] = useState(initialMeta);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isInitialRequest = statusFilter === "all" && page === 1;

  const fetchOrders = useCallback(
    async (targetPage: number, targetStatus: OrderStatus | "all") => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams({ page: String(targetPage) });
        if (targetStatus !== "all") params.set("status", targetStatus);

        const response = await fetch(`/api/v1/orders?${params.toString()}`);
        const body = await response.json();

        if (!response.ok) {
          setLoadError(body?.error?.message ?? "Não foi possível carregar os pedidos.");
          setIsLoading(false);
          return;
        }

        const success = body as ApiSuccess<OrderListRow[]>;
        setOrders(success.data);
        if (success.meta) {
          setMeta(success.meta);
        }
      } catch {
        setLoadError("Não foi possível conectar. Verifique sua internet e tente novamente.");
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Refaz a busca ao trocar de filtro/página — pula a primeira renderização
  // (página 1, filtro "Todos"), que já chega pronta do Server Component e
  // não precisa de um round-trip extra imediato.
  useEffect(() => {
    if (isInitialRequest) return;
    void fetchOrders(page, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só deve reagir a page/statusFilter; fetchOrders é estável (useCallback sem deps).
  }, [page, statusFilter]);

  function handleFilterChange(value: OrderStatus | "all") {
    setStatusFilter(value);
    setPage(1);
  }

  // Supabase Realtime: qualquer pedido criado/atualizado deste restaurante
  // dispara um refetch da página/filtro atuais — mais simples e mais
  // correto do que tentar reconciliar o evento bruto (insert/update) com
  // paginação e filtro de status no cliente.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(restaurantOrdersChannel(restaurantId))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          void fetchOrders(page, statusFilter);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // Reassina só quando o restaurante muda — `page`/`statusFilter` são lidos
    // via closure mais recente porque `fetchOrders` já os recebe como
    // argumento explícito na hora da chamada, não precisam entrar aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const filterTabs = useMemo(
    () =>
      STATUS_FILTERS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          onClick={() => handleFilterChange(filter.value)}
          aria-pressed={statusFilter === filter.value}
          className={cn(
            "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            statusFilter === filter.value
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/70",
          )}
        >
          {filter.label}
        </button>
      )),
    [statusFilter],
  );

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Filtrar pedidos por status"
        className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {filterTabs}
      </div>

      {loadError && (
        <Alert variant="destructive" className="items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => void fetchOrders(page, statusFilter)}>
            Tentar novamente
          </Button>
        </Alert>
      )}

      {!loadError && !isLoading && orders.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nenhum pedido encontrado"
          description={
            statusFilter === "all"
              ? "Assim que um cliente pedir pela mesa, ele aparece aqui."
              : "Nenhum pedido com este status no momento."
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mesa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonTableRow key={i} columns={5} />)
              : orders.map((order) => (
                  <TableRow
                    key={order.id}
                    tabIndex={0}
                    role="link"
                    aria-label={`Ver pedido da mesa ${order.table.name}`}
                    onClick={() => router.push(ROUTES.pedidoDetalhe(order.id))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") router.push(ROUTES.pedidoDetalhe(order.id));
                    }}
                    className="cursor-pointer focus-visible:bg-muted/40 focus-visible:outline-none"
                  >
                    <TableCell className="font-medium text-foreground">{order.table.name}</TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell>{order.item_count}</TableCell>
                    <TableCell className="font-mono">{formatCurrency(order.total_amount)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {dateTimeFormatter.format(new Date(order.created_at))}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      )}

      <Pagination page={meta.page} totalPages={meta.total_pages} onPageChange={setPage} />
    </div>
  );
}
