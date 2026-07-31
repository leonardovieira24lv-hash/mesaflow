"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { AdminOrderStatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Pagination } from "@/components/ui/pagination";
import { SkeletonTableRow } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { restaurantOrdersChannel } from "@/lib/realtime/channels";
import { useRealtimeConnectionStatus } from "@/lib/realtime/use-realtime-connection-status";
import { RealtimeStatusIndicator } from "@/components/realtime/realtime-status-indicator";
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

// Sprint "Simplificação do Fluxo de Status" (2026-07-30): "Prontos"
// removido — nenhum pedido novo chega mais em `ready` (ver
// `order-status-transitions-map.ts`). Se restar algum pedido legado nesse
// status, ele continua existindo no banco e aparece com o rótulo/cor de
// "Em preparo" (`AdminOrderStatusBadge`), só não tem mais um filtro
// dedicado — não vale a pena manter um filtro pra um estado que a
// interface inteira já esconde.
const STATUS_FILTERS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pedido realizado" },
  { value: "preparing", label: "Em preparo" },
  { value: "delivered", label: "Finalizados" },
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

  // Sprint 2 (Painel Vivo): status do canal Realtime já assinado abaixo,
  // exibido via `<RealtimeStatusIndicator>`.
  const { status: realtimeStatus, reportStatus } = useRealtimeConnectionStatus(["orders"]);

  // Microinteração: quando um pedido chega ou muda de status, sua linha
  // recebe um destaque suave (fundo + fade, sem afetar o layout da
  // tabela) por ~900ms — mesmo padrão de diff-por-transição já usado no
  // flash dos tiles de mesa (`tables-manager.tsx`), adaptado para não usar
  // `scale`/`boxShadow` (não fazem sentido numa linha de tabela).
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const prevStatusesRef = useRef<Record<string, OrderStatus>>({});

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

  useEffect(() => {
    const previous = prevStatusesRef.current;
    const currentStatuses: Record<string, OrderStatus> = {};
    const changedIds: string[] = [];

    for (const order of orders) {
      currentStatuses[order.id] = order.status;
      if (previous[order.id] === undefined || previous[order.id] !== order.status) {
        changedIds.push(order.id);
      }
    }

    const isFirstLoad = Object.keys(previous).length === 0;
    prevStatusesRef.current = currentStatuses;

    // Pula o destaque na primeiríssima carga (dado inicial do Server
    // Component) — só marca "novo/mudou" quando já havia um estado
    // anterior para comparar, igual ao mesmo cuidado em `tables-manager.tsx`.
    if (isFirstLoad || changedIds.length === 0) return;

    setHighlightedIds((prev) => new Set([...prev, ...changedIds]));
    const timer = setTimeout(() => {
      setHighlightedIds((prev) => {
        const next = new Set(prev);
        changedIds.forEach((id) => next.delete(id));
        return next;
      });
    }, 900);

    return () => clearTimeout(timer);
  }, [orders]);

  function handleFilterChange(value: OrderStatus | "all") {
    setStatusFilter(value);
    setPage(1);
  }

  // Sprint 4 de Correção (Fase de Estabilização) — bug da auditoria: o
  // efeito de Realtime abaixo só reassina quando `restaurantId` muda
  // (de propósito, para não recriar o canal a cada troca de filtro/página).
  // Só que o handler chamava `fetchOrders(page, statusFilter)` lendo essas
  // duas variáveis direto do closure em que o efeito foi criado — como elas
  // não estão nas deps do efeito, ficavam "congeladas" no valor que tinham
  // no primeiro render (page 1, filtro "Todos"). Resultado: um evento de
  // Realtime chegando enquanto o atendente estava numa página/filtro
  // diferente jogava a lista de volta para a página 1 sem filtro, sem
  // aviso. Refs sempre atualizadas resolvem isso sem precisar recriar o
  // canal a cada mudança de filtro/página.
  const pageRef = useRef(page);
  const statusFilterRef = useRef(statusFilter);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  useEffect(() => {
    statusFilterRef.current = statusFilter;
  }, [statusFilter]);

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
          void fetchOrders(pageRef.current, statusFilterRef.current);
        },
      )
      .subscribe((subscriptionStatus) => reportStatus("orders", subscriptionStatus));

    return () => {
      void supabase.removeChannel(channel);
    };
    // Reassina só quando o restaurante muda — a página/filtro atuais são
    // lidos das refs acima no momento em que o evento chega, não daqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  // Estas abas são um grupo de seleção (Segmented Control/Toggle Group),
  // não botões de ação isolados — por isso não usam `<Button>`, mesmo
  // reproduzindo manualmente um padrão parecido com os filtros do Painel
  // de Mesas. Dívida técnica registrada para uma sprint própria futura.
  const filterTabs = useMemo(
    () =>
      STATUS_FILTERS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          onClick={() => handleFilterChange(filter.value)}
          aria-pressed={statusFilter === filter.value}
          className={cn(
            "shrink-0 rounded-ds2-full px-4 py-1.5 text-sm font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds2-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ds2-background",
            statusFilter === filter.value
              ? "bg-ds2-primary text-ds2-primary-foreground"
              : "bg-ds2-surface-hover text-ds2-foreground-muted hover:bg-ds2-surface-hover/70",
          )}
        >
          {filter.label}
        </button>
      )),
    [statusFilter],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Filtrar pedidos por status"
          className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {filterTabs}
        </div>
        <RealtimeStatusIndicator status={realtimeStatus} className="self-start sm:self-auto" />
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
                    className={cn(
                      "cursor-pointer transition-colors duration-700",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ds2-ring",
                      highlightedIds.has(order.id) && "bg-ds2-primary/10",
                    )}
                  >
                    <TableCell className="font-medium text-ds2-foreground">{order.table.name}</TableCell>
                    <TableCell>
                      <AdminOrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell>{order.item_count}</TableCell>
                    <TableCell className="font-numeric">{formatCurrency(order.total_amount)}</TableCell>
                    <TableCell className="text-ds2-foreground-muted">
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
