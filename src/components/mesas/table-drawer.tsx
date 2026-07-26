"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChefHat, Clock3, Loader2, Printer, Receipt, StickyNote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminOrderStatusBadge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatCurrency, formatRelativeTimeShort } from "@/lib/format";
import { ROUTES } from "@/constants/routes";
import {
  deriveTableCardState,
  TABLE_CARD_FILLED_TONES,
  TABLE_CARD_TONE_DOT_CLASSES,
  TABLE_CARD_TONE_CLASSES,
} from "@/lib/mesas/derive-table-card-state";
import type { OrderListRow } from "@/components/pedidos/orders-list";
import type { Table as TableEntity } from "@/types/domain";
import type { ApiSuccess } from "@/types/api";

interface OrderDetail {
  id: string;
  status: OrderListRow["status"];
  total_amount: number;
  notes?: string;
  created_at: string;
  items: { id: string; name: string; quantity: number; price: number; notes?: string }[];
}

interface TableDrawerProps {
  table: TableEntity;
  openOrders: OrderListRow[];
  onClose: () => void;
  /** Chamado depois de qualquer ação que muda um pedido — o pai refaz a agregação. */
  onOrdersChanged: () => void;
  /** Chamado depois de liberar/fechar a mesa — o pai atualiza a lista de mesas local. */
  onTableUpdated: (table: TableEntity) => void;
}

/**
 * Painel lateral de uma mesa (Painel de Mesas → "Centro de Operações",
 * pedido do dono). Drawer nativo (`<dialog>`), mesmo padrão de
 * `product-detail-modal.tsx`: bottom sheet no mobile, painel lateral da
 * direita a partir de `sm:` — aqui faz mais sentido inverter a proporção
 * do cliente (lá o conteúdo é uma vitrine vertical; aqui é uma lista, cabe
 * melhor num painel estreito e alto).
 *
 * Ações: só as que têm suporte real hoje.
 * - "Enviar para cozinha" — transição real `pending → preparing`
 *   (`PATCH /api/v1/orders/{id}/status`, o mesmo endpoint da tela de
 *   Pedidos).
 * - "Fechar conta" — não existe um endpoint de "fechar comanda" único;
 *   isto compõe dois passos reais (marcar cada pedido aberto como
 *   `delivered` + liberar a mesa) e só fica disponível quando todo pedido
 *   aberto já está `ready` — pular direto de `pending`/`preparing` para
 *   `delivered` violaria a máquina de estados real
 *   (`lib/orders/order-status-transitions-map.ts`), então o botão avisa em
 *   vez de tentar e falhar.
 * - "Solicitar impressão" — `window.print()` sobre uma view formatada
 *   (`#print-comanda-drawer`, ver `globals.css`). Não existe impressora térmica
 *   integrada; isto imprime pelo navegador, real e funcional, não decorativo.
 * - "Liberar mesa" — `PATCH /api/v1/tables/{id}` (`status: livre`), a mesma
 *   ação que já existia no seletor rápido do card.
 * - "Adicionar item" (pedido do dono) NÃO está aqui: não existe endpoint
 *   administrativo para adicionar item a um pedido já criado — só o
 *   cliente cria pedidos, pela própria mesa. Ver `docs/table-events-roadmap.md`.
 */
export function TableDrawer({ table, openOrders, onClose, onOrdersChanged, onTableUpdated }: TableDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [details, setDetails] = useState<Record<string, OrderDetail>>({});
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  // Trava síncrona — mesmo raciocínio de `order-detail.tsx`: `setState` só
  // reflete no próximo render, então um duplo toque rápido podia escapar do
  // `disabled` do botão antes dele atualizar de verdade.
  const isSendingToKitchenRef = useRef(false);
  const [isClosingBill, setIsClosingBill] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const isClosingBillRef = useRef(false);
  const isReleasingRef = useRef(false);
  const [confirmingRelease, setConfirmingRelease] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
  }, []);

  // Busca o detalhe completo (com itens) de cada pedido aberto da mesa —
  // a lista agregada do painel só tem `item_count`, não os itens em si.
  useEffect(() => {
    let cancelled = false;
    setLoadingDetails(true);

    Promise.all(
      openOrders.map((o) =>
        fetch(`/api/v1/orders/${o.id}`)
          .then((r) => r.json())
          .then((body: ApiSuccess<OrderDetail>) => body.data),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, OrderDetail> = {};
        for (const detail of results) map[detail.id] = detail;
        setDetails(map);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar os itens dos pedidos.");
      })
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reage à identidade da mesa/lista de ids, recalculada abaixo
  }, [table.id, openOrders.map((o) => o.id).join(",")]);

  /**
   * Sprint de Correção de Regressões Críticas — Bug 2: mesmo raciocínio de
   * `order-detail.tsx` — a checagem de concorrência otimista do endpoint
   * está correta; o que faltava aqui era resincronizar a tela quando ela
   * rejeita por causa de dado desatualizado (ex.: o mesmo pedido já foi
   * avançado pela tela de Pedidos). `onOrdersChanged()` já existe e refaz a
   * agregação no componente pai — chamando também no caminho de erro (antes
   * só acontecia no de sucesso), a lista de pedidos abertos desta mesa se
   * atualiza sozinha em vez de ficar presa mostrando uma ação que vai
   * falhar de novo.
   */
  async function handleSendToKitchen(orderId: string) {
    if (isSendingToKitchenRef.current) return;
    isSendingToKitchenRef.current = true;

    setUpdatingOrderId(orderId);
    setError(null);
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "preparing" }),
      });
      const body = await response.json();
      if (!response.ok) {
        const isConflict = body?.error?.code === "CONFLICT";
        setError(
          isConflict
            ? "Este pedido já tinha sido atualizado — a lista foi atualizada com o status mais recente."
            : (body?.error?.message ?? "Não foi possível enviar para a cozinha."),
        );
        onOrdersChanged();
        return;
      }
      toast.success("Pedido enviado para a cozinha");
      onOrdersChanged();
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setUpdatingOrderId(null);
      isSendingToKitchenRef.current = false;
    }
  }

  const allReady = openOrders.length > 0 && openOrders.every((o) => o.status === "ready");

  /**
   * Sprint Pós-Auditoria (RC1.1) — item 3: antes, o laço de PATCH sequencial
   * lançava no primeiro erro e esquecia o que já tinha dado certo. Se o
   * atendente tentasse de novo antes do Realtime atualizar `openOrders`
   * (prop vinda do pai), o pedido que JÁ estava `delivered` era reenviado —
   * e a máquina de estados rejeita `delivered → delivered`, um erro confuso
   * que não deixa claro que parte do trabalho já tinha sido feita.
   *
   * Duas mudanças, nenhuma delas toca a máquina de estados
   * (`lib/orders/status-transitions.ts` continua exatamente igual):
   *
   *  1. Filtra `openOrders` para só tentar pedidos que ainda não estão num
   *     estado terminal — um retry nunca mais reenvia um pedido que já foi
   *     fechado com sucesso, mesmo que `openOrders` ainda esteja
   *     desatualizado no momento do clique.
   *  2. Se algo falhar no meio do caminho, a mensagem de erro conta
   *     exatamente quantos pedidos já foram fechados e quantos ainda
   *     faltam — e `onOrdersChanged()` é chamado imediatamente (não só no
   *     caminho de sucesso), então o próximo clique já parte de um estado
   *     atualizado, sem esperar o Realtime.
   */
  async function handleCloseBill() {
    if (isClosingBillRef.current) return;
    isClosingBillRef.current = true;

    setIsClosingBill(true);
    setError(null);

    const pendingOrders = openOrders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
    let closedCount = 0;

    try {
      for (const order of pendingOrders) {
        const response = await fetch(`/api/v1/orders/${order.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "delivered" }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          const remaining = pendingOrders.length - closedCount;
          onOrdersChanged();
          throw new Error(
            closedCount > 0
              ? `${closedCount} de ${pendingOrders.length} pedidos foram fechados. ${remaining === 1 ? "Falta 1" : `Faltam ${remaining}`} — ${body?.error?.message ?? "tente novamente"}.`
              : (body?.error?.message ?? "Não foi possível fechar os pedidos. Tente novamente."),
          );
        }

        closedCount += 1;
      }

      const tableResponse = await fetch(`/api/v1/tables/${table.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "livre" }),
      });
      const tableBody = await tableResponse.json();
      if (!tableResponse.ok) {
        onOrdersChanged();
        throw new Error(
          tableBody?.error?.message ??
            "Todos os pedidos foram fechados, mas não foi possível liberar a mesa. Tente liberar manualmente.",
        );
      }

      toast.success("Conta fechada", `${table.name} foi liberada.`);
      onOrdersChanged();
      onTableUpdated({ id: table.id, name: table.name, status: "livre", qrToken: table.qrToken });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível fechar a conta.");
    } finally {
      setIsClosingBill(false);
      isClosingBillRef.current = false;
    }
  }

  async function handleReleaseTable() {
    if (isReleasingRef.current) return;
    isReleasingRef.current = true;

    setIsReleasing(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/tables/${table.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "livre" }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "Não foi possível liberar a mesa.");
        return;
      }
      toast.success("Mesa liberada");
      onTableUpdated({ id: table.id, name: table.name, status: "livre", qrToken: table.qrToken });
      setConfirmingRelease(false);
      onClose();
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setIsReleasing(false);
      isReleasingRef.current = false;
    }
  }

  const subtotal = openOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const itemCount = openOrders.reduce((sum, o) => sum + o.item_count, 0);
  const hasPendingOrder = openOrders.some((o) => o.status === "pending");
  const orderTimestamps = openOrders.map((o) => o.created_at);
  const openedAt = orderTimestamps.length > 0 ? orderTimestamps.reduce((a, b) => (a < b ? a : b)) : null;
  const lastOrderAt = orderTimestamps.length > 0 ? orderTimestamps.reduce((a, b) => (a > b ? a : b)) : null;

  const cardState = deriveTableCardState(
    table.status,
    openOrders.length > 0 ? { totalAmount: subtotal, itemCount, lastOrderAt, hasPendingOrder } : null,
    [],
  );
  const isFilled = TABLE_CARD_FILLED_TONES.includes(cardState.tone);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={`Mesa ${table.name}`}
      className={cn(
        "fixed inset-x-0 bottom-0 top-auto m-0 max-h-[88vh] w-full overflow-hidden rounded-t-3xl border-t border-border bg-surface p-0 text-surface-foreground shadow-sheet",
        "sm:inset-y-0 sm:left-auto sm:right-0 sm:bottom-0 sm:top-0 sm:m-0 sm:h-full sm:max-h-none sm:w-[420px] sm:rounded-none sm:rounded-l-2xl sm:border-l sm:border-t-0 sm:shadow-card-hover",
        "backdrop:bg-black/50 backdrop:backdrop-blur-[2px]",
        "open:animate-sheet-up sm:open:animate-slide-in-right",
      )}
    >
      <div className="flex h-full max-h-[88vh] flex-col sm:max-h-none">
        <div
          className={cn(
            "flex flex-col gap-3 border-b border-border px-5 py-4",
            isFilled && TABLE_CARD_TONE_CLASSES[cardState.tone],
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1.5">
              <span className="font-numeric text-3xl font-bold leading-none tabular-nums">{table.name}</span>
              <span
                className={cn(
                  "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                  isFilled ? "bg-white/20 text-white" : "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    isFilled ? "bg-white/70" : TABLE_CARD_TONE_DOT_CLASSES[cardState.tone],
                  )}
                  aria-hidden
                />
                {cardState.label}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Fechar"
              className={cn(isFilled && "text-white hover:bg-white/15 hover:text-white")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-end justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <span className={cn("text-xs", isFilled ? "text-white/80" : "text-muted-foreground")}>Valor atual</span>
              <span className="font-numeric text-2xl font-bold leading-tight tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            {openedAt && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs",
                  isFilled ? "text-white/80" : "text-muted-foreground",
                )}
              >
                <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                aberta há {formatRelativeTimeShort(openedAt)}
              </span>
            )}
          </div>
        </div>

        {openOrders.length > 0 && (
          <div className="grid grid-cols-2 gap-2 border-b border-border px-5 py-3">
            <div className="flex flex-col items-center gap-0.5 rounded-xl bg-muted/50 py-2.5">
              <span className="font-numeric text-lg font-bold tabular-nums text-foreground">{openOrders.length}</span>
              <span className="text-[11px] text-muted-foreground">{openOrders.length === 1 ? "Pedido" : "Pedidos"}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 rounded-xl bg-muted/50 py-2.5">
              <span className="font-numeric text-lg font-bold tabular-nums text-foreground">{itemCount}</span>
              <span className="text-[11px] text-muted-foreground">{itemCount === 1 ? "Item" : "Itens"}</span>
            </div>
          </div>
        )}

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          {error && <Alert variant="destructive">{error}</Alert>}

          {openOrders.length > 0 && (
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pedidos desta mesa
            </span>
          )}

          {openOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido em aberto nesta mesa.</p>
          ) : loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {openOrders.map((order) => {
                const detail = details[order.id];
                return (
                  <div
                    key={order.id}
                    className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3.5 shadow-card"
                  >
                    <div className="flex items-center justify-between">
                      <AdminOrderStatusBadge status={order.status} />
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock3 className="h-3 w-3 shrink-0" aria-hidden />
                        {formatRelativeTimeShort(order.created_at)}
                      </span>
                    </div>

                    {detail ? (
                      <ul className="flex flex-col gap-2">
                        {detail.items.map((item) => (
                          <li key={item.id} className="flex flex-col gap-0.5">
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <span className="flex items-center gap-2 text-foreground">
                                <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-muted px-1 font-numeric text-[11px] font-semibold text-muted-foreground">
                                  {item.quantity}×
                                </span>
                                {item.name}
                              </span>
                              <span className="font-numeric font-medium text-muted-foreground">
                                {formatCurrency(item.price * item.quantity)}
                              </span>
                            </div>
                            {item.notes && (
                              <span className="flex items-center gap-1 pl-7 text-xs italic text-muted-foreground">
                                <StickyNote className="h-3 w-3 shrink-0" aria-hidden />
                                {item.notes}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">Itens indisponíveis.</p>
                    )}

                    <div className="flex items-center justify-between border-t border-border pt-2.5">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <Receipt className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        Subtotal
                      </span>
                      <span className="font-numeric text-base font-bold tabular-nums text-foreground">
                        {formatCurrency(order.total_amount)}
                      </span>
                    </div>

                    {order.status === "pending" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendToKitchen(order.id)}
                        isLoading={updatingOrderId === order.id}
                        className="w-full justify-center"
                      >
                        <ChefHat className="h-3.5 w-3.5" />
                        Enviar para cozinha
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* View de impressão — só visível em @media print (globals.css), some do resto da UI.
            Sprint 2 de Correção: id próprio (antes era "print-comanda", igual ao usado por
            TableQrModal — dois elementos com o mesmo id no DOM é HTML inválido e faria a
            regra de impressão em globals.css aplicar aos dois ao mesmo tempo). */}
        <div id="print-comanda-drawer" className="hidden">
          <h1>{table.name}</h1>
          {openOrders.map((order) => (
            <div key={order.id}>
              {(details[order.id]?.items ?? []).map((item) => (
                <p key={item.id}>
                  {item.quantity}x {item.name} — {formatCurrency(item.price * item.quantity)}
                </p>
              ))}
            </div>
          ))}
          <p>Total: {formatCurrency(subtotal)}</p>
        </div>

        <div className="flex flex-col gap-2 border-t border-border px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Total da mesa</span>
            <span className="font-numeric text-lg font-bold tabular-nums text-foreground">{formatCurrency(subtotal)}</span>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => window.print()} disabled={openOrders.length === 0}>
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmingRelease(true)}
              disabled={isReleasing}
            >
              Liberar mesa
            </Button>
          </div>

          <Button
            type="button"
            onClick={handleCloseBill}
            isLoading={isClosingBill}
            disabled={!allReady}
            title={!allReady ? "Só é possível fechar a conta quando todos os pedidos estiverem prontos" : undefined}
          >
            Fechar conta
          </Button>
          {!allReady && openOrders.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Ainda há pedido{openOrders.length > 1 ? "s" : ""} em preparo — fechar a conta libera quando tudo estiver pronto.
            </p>
          )}

          {openOrders.length > 0 && (
            <Link
              href={ROUTES.pedidoDetalhe(openOrders[0]!.id)}
              className="text-center text-xs font-medium text-primary hover:underline"
            >
              Ver histórico completo de pedidos desta mesa
            </Link>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmingRelease}
        onOpenChange={setConfirmingRelease}
        title="Liberar mesa"
        description={
          openOrders.length > 0
            ? `${table.name} ainda tem ${openOrders.length} pedido(s) em aberto. Liberar mesmo assim?`
            : `Liberar ${table.name}?`
        }
        confirmLabel="Liberar"
        onConfirm={handleReleaseTable}
        isConfirming={isReleasing}
      />
    </dialog>
  );
}
