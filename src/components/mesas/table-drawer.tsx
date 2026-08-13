"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCircle2, ChefHat, Clock3, Hand, Loader2, Printer, Receipt, StickyNote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminOrderStatusBadge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { CloseBillModal } from "@/components/mesas/close-bill-modal";
import { cn } from "@/lib/utils";
import { formatCurrency, formatRelativeTimeShort } from "@/lib/format";
import { ROUTES } from "@/constants/routes";
import {
  deriveTableCardState,
  TABLE_CARD_FILLED_TONES,
  TABLE_CARD_TONE_DOT_CLASSES,
  TABLE_CARD_TONE_CLASSES,
  TABLE_CARD_TONE_DARK_TEXT,
  type TableCardAlert,
} from "@/lib/mesas/derive-table-card-state";
import type { OrderListRow } from "@/components/pedidos/orders-list";
import type { Table as TableEntity } from "@/types/domain";
import type { ApiSuccess } from "@/types/api";
import type { PAYMENT_METHOD_VALUES } from "@/lib/validations/tables";

type PaymentMethod = (typeof PAYMENT_METHOD_VALUES)[number];

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
  /** "Chamar garçom" / "Solicitar conta" em aberto nesta mesa (docs/table-events-roadmap.md). */
  alerts: TableCardAlert[];
  /** Fase 4B.1 (2026-08-10) — já normalizado (`resolveAcceptedPaymentMethods`); só passagem até `<CloseBillModal>`. */
  acceptedPaymentMethods: PaymentMethod[];
  onClose: () => void;
  /** Chamado depois de qualquer ação que muda um pedido — o pai refaz a agregação. */
  onOrdersChanged: () => void;
  /** Chamado depois de reconhecer/resolver um alerta — o pai refaz a busca de eventos. */
  onAlertsChanged: () => void;
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
 * - "Pedido pronto" (Sprint "Fluxo Operacional das Mesas", item 2 do
 *   checklist) — transição real `preparing → ready`, mesmo endpoint acima;
 *   antes só existia na tela de Pedidos, obrigando o atendente a sair de
 *   Mesas para avançar um pedido em preparo.
 * - "Fechar conta" / "Finalizar atendimento" (item 3 do checklist: mesmo
 *   botão, rótulo muda conforme o estágio) — só fica disponível quando todo
 *   pedido aberto já está `ready` (aí o rótulo vira "Finalizar
 *   atendimento", a etapa final do fluxo) — pular direto de
 *   `pending`/`preparing` para `delivered` violaria a máquina de estados
 *   real (`lib/orders/order-status-transitions-map.ts`), então o botão
 *   avisa em vez de tentar e falhar.
 *
 *   Sprint "Fechamento de Conta com Registro de Venda" (2026-07-29): este
 *   botão não fecha mais a mesa direto — abre `<CloseBillModal>` (resumo da
 *   comanda + escolha da forma de pagamento). Só na confirmação de lá é que
 *   `handleConfirmPayment` roda de verdade: (1) o mesmo laço de sempre
 *   marcando cada pedido aberto como `delivered`
 *   (`PATCH /api/v1/orders/{id}/status`, endpoint inalterado), (2)
 *   `PATCH /api/v1/tables/{id}/close-bill` (rota nova) — fecha a
 *   `order_session` da mesa com a forma de pagamento e só então libera a
 *   mesa. "Cancelar" no modal simplesmente fecha ele, sem chamar nada — a
 *   mesa continua exatamente como estava.
 *
 *   Sprint "Correção — Fechamento de Conta Não-Atômico" (2026-07-30,
 *   seguinte): duas correções. (1) `close-bill` agora faz as duas escritas
 *   (fechar sessão + liberar mesa) numa única transação no banco (RPC
 *   `close_table_bill`, `0019_atomic_close_table_bill.sql`) — antes, se a
 *   segunda falhasse, a comanda ficava fechada mas a mesa presa em
 *   "ocupada" pra sempre. (2) `<CloseBillModal>` não recebe mais
 *   `openOrders`/`details`/`openedAt` como props — busca tudo sozinho, na
 *   hora, direto da API, em vez de depender do estado que este componente
 *   carrega uma vez e mantém "vivo" só via Realtime (canal já registrado
 *   como instável). `openOrders`/`details` continuam existindo aqui só
 *   para o resto do Drawer (lista de pedidos exibida no corpo do Drawer,
 *   `allDelivered` do botão) — não foram removidos, só pararam de alimentar
 *   o modal.
 *
 *   Sprint "Refatoração — Backend Assume Marcação de Entregue" (2026-07-30,
 *   seguinte): `handleConfirmPayment` ainda decidia quais pedidos marcar
 *   como `delivered` a partir de `openOrders` antes de chamar o
 *   fechamento — a mesma dependência de estado cacheado que a correção
 *   anterior só tinha removido do `<CloseBillModal>`, não da ação de
 *   confirmar. Removido: o frontend só pede o fechamento
 *   (`PATCH tables/{id}/close-bill`, sem nenhum PATCH de pedido antes) —
 *   `close_table_bill` (`0020_close_table_bill_marks_delivered.sql`) busca
 *   os pedidos reais da sessão no banco e marca como `delivered` o que
 *   ainda não estiver terminal, na mesma transação que fecha a sessão e
 *   libera a mesa.
 * - "Solicitar impressão" — `window.print()` sobre uma view formatada
 *   (`#print-comanda-drawer`, ver `globals.css`). Não existe impressora térmica
 *   integrada; isto imprime pelo navegador, real e funcional, não decorativo.
 * - "Liberar mesa" — `PATCH /api/v1/tables/{id}` (`status: livre`), a mesma
 *   ação que já existia no seletor rápido do card.
 * - "Adicionar item" (pedido do dono) NÃO está aqui: não existe endpoint
 *   administrativo para adicionar item a um pedido já criado — só o
 *   cliente cria pedidos, pela própria mesa. Ver `docs/table-events-roadmap.md`.
 */
export function TableDrawer({
  table,
  openOrders,
  alerts,
  acceptedPaymentMethods,
  onClose,
  onOrdersChanged,
  onAlertsChanged,
  onTableUpdated,
}: TableDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [details, setDetails] = useState<Record<string, OrderDetail>>({});
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  // Trava síncrona — mesmo raciocínio de `order-detail.tsx`: `setState` só
  // reflete no próximo render, então um duplo toque rápido podia escapar do
  // `disabled` do botão antes dele atualizar de verdade.
  const isSendingToKitchenRef = useRef(false);
  // Sprint "Simplificação do Fluxo de Status" (2026-07-30, era
  // isMarkingReadyRef/"Pedido pronto" — preparing→ready deixou de existir,
  // esta ação agora vai direto preparing→delivered): mesmo raciocínio do
  // lock acima.
  const isMarkingDeliveredRef = useRef(false);
  // "Chamar garçom" / "Solicitar conta" — mesmo raciocínio de lock, para
  // não deixar um duplo toque em "Atendido"/"Conta entregue" disparar duas
  // requisições para o mesmo evento.
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);
  const isResolvingAlertRef = useRef(false);
  const [isClosingBill, setIsClosingBill] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const isClosingBillRef = useRef(false);
  const isReleasingRef = useRef(false);
  const [confirmingRelease, setConfirmingRelease] = useState(false);
  const [closeBillModalOpen, setCloseBillModalOpen] = useState(false);
  const [closeBillError, setCloseBillError] = useState<string | null>(null);
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

  /**
   * Sprint "Simplificação do Fluxo de Status" (2026-07-30): antes,
   * `handleMarkReady` fazia a transição `preparing → ready` ("Pedido
   * pronto"). O MesaFlow não é delivery — o garçom leva o pedido até a
   * mesa, então "pronto" e "entregue" viram um único momento pro cliente
   * ("Finalizado"). Mesma estrutura exata de antes (mesmo endpoint, mesmo
   * tratamento de conflito, mesmo `onOrdersChanged()`), só o status de
   * destino e as mensagens mudaram — agora vai direto `preparing → delivered`.
   */
  async function handleMarkDelivered(orderId: string) {
    if (isMarkingDeliveredRef.current) return;
    isMarkingDeliveredRef.current = true;

    setUpdatingOrderId(orderId);
    setError(null);
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "delivered" }),
      });
      const body = await response.json();
      if (!response.ok) {
        const isConflict = body?.error?.code === "CONFLICT";
        setError(
          isConflict
            ? "Este pedido já tinha sido atualizado — a lista foi atualizada com o status mais recente."
            : (body?.error?.message ?? "Não foi possível marcar como finalizado."),
        );
        onOrdersChanged();
        return;
      }
      toast.success("Pedido finalizado");
      onOrdersChanged();
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setUpdatingOrderId(null);
      isMarkingDeliveredRef.current = false;
    }
  }

  /**
   * "Chamar garçom" / "Solicitar conta" — botões "Atendido" / "Conta
   * impressa/entregue" (docs/table-events-roadmap.md seção 4, item 3).
   * Sempre resolve direto (`status: "resolved"`), sem passar por
   * `"acknowledged"` — para o fluxo de um atendente sozinho, "vi e já
   * resolvi" é o caso comum; `acknowledged` fica disponível na API para uso
   * futuro (ex.: um segundo atendente "reservando" o alerta antes de ir até
   * a mesa), mas não tem UI própria ainda por não ser um pedido feito nesta
   * sprint.
   */
  async function handleResolveAlert(eventId: string) {
    if (isResolvingAlertRef.current) return;
    isResolvingAlertRef.current = true;

    setResolvingAlertId(eventId);
    setError(null);
    try {
      const response = await fetch(`/api/v1/tables/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });
      const body = await response.json();
      if (!response.ok) {
        const isConflict = body?.error?.code === "CONFLICT";
        setError(
          isConflict
            ? "Este alerta já tinha sido resolvido — a lista foi atualizada."
            : (body?.error?.message ?? "Não foi possível atualizar o alerta."),
        );
        onAlertsChanged();
        return;
      }
      toast.success("Alerta resolvido");
      onAlertsChanged();
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setResolvingAlertId(null);
      isResolvingAlertRef.current = false;
    }
  }

  const waiterCallAlert = alerts.find((a) => a.type === "waiter_call");
  const billRequestAlert = alerts.find((a) => a.type === "bill_request");

  // Sprint "Simplificação do Fluxo de Status" (2026-07-30, era `allReady`
  // checando "ready"): preparing agora vai direto pra delivered, então "os
  // pedidos já estão prontos pra fechar a conta" passa a significar "todos
  // já foram finalizados".
  const allDelivered = openOrders.length > 0 && openOrders.every((o) => o.status === "delivered");

  /**
   * Sprint "Fechamento de Conta com Registro de Venda" (2026-07-29): antes
   * chamado direto pelo botão "Fechar conta"/"Finalizar atendimento", agora
   * só roda a partir da confirmação em `<CloseBillModal>`, já com a forma
   * de pagamento escolhida.
   *
   * Sprint "Refatoração — Backend Assume Marcação de Entregue" (2026-07-30,
   * seguinte): esta função chegou a ter um laço que marcava cada pedido de
   * `openOrders` como `delivered` antes de chamar o fechamento — removido.
   * `openOrders` é estado de interface (cacheado em `tables-manager.tsx`,
   * atualizado só por Realtime), e uma escrita no banco não pode depender
   * dele: se estivesse desatualizado, o laço deixava de tocar o pedido
   * real, e o fechamento falhava sem motivo aparente pro atendente. Agora
   * esta função só *pede* o fechamento — `PATCH tables/{id}/close-bill`
   * (que chama `close_table_bill`, `0020_close_table_bill_marks_delivered.sql`)
   * busca os pedidos reais da sessão direto no banco e marca como
   * `delivered` o que ainda não estiver num status terminal, na mesma
   * transação que fecha a sessão e libera a mesa. Nenhuma decisão de quais
   * registros mudam depende mais de `openOrders`.
   */
  async function handleConfirmPayment(paymentMethod: PaymentMethod) {
    if (isClosingBillRef.current) return;
    isClosingBillRef.current = true;

    setIsClosingBill(true);
    setCloseBillError(null);

    try {
      const closeBillResponse = await fetch(`/api/v1/tables/${table.id}/close-bill`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_method: paymentMethod }),
      });
      const closeBillBody = await closeBillResponse.json();
      if (!closeBillResponse.ok) {
        throw new Error(closeBillBody?.error?.message ?? "Não foi possível fechar a conta. Tente novamente.");
      }

      toast.success("Pagamento registrado", `${table.name} foi liberada.`);
      onOrdersChanged();
      onTableUpdated({ id: table.id, name: table.name, status: "livre", qrToken: table.qrToken });
      setCloseBillModalOpen(false);
      onClose();
    } catch (err) {
      onOrdersChanged();
      setCloseBillError(err instanceof Error ? err.message : "Não foi possível fechar a conta.");
    } finally {
      setIsClosingBill(false);
      isClosingBillRef.current = false;
    }
  }

  /**
   * Sprint "Correção do QR Code" — causa raiz real da regressão: "Liberar
   * mesa" sempre só fez `PATCH tables/{id}` (`status: livre`) — nunca tocou
   * os pedidos. Se havia pedido aberto no momento (a própria confirmação já
   * avisa "ainda tem N pedido(s) em aberto — liberar mesmo assim?", ou seja,
   * era um caminho sempre permitido, não um caso raro), esse pedido ficava
   * para sempre com status não-terminal no banco — "ocupada" só na tela,
   * nunca resolvido de verdade.
   *
   * `getActiveOrderForTable` (lib/orders/active-order.ts) busca por
   * `table_id` + status não-terminal, sem nenhuma noção de "sessão" — então
   * esse pedido órfão continuava sendo encontrado por ela indefinidamente.
   * E é exatamente essa função que decide para onde o resolvedor do QR Code
   * (`mesa/[token]/page.tsx`) redireciona: `activeOrder` truthy →
   * acompanhamento do pedido; senão → cardápio. Resultado comprovado por
   * simulação: um cliente novo, sentando na mesma mesa física dias depois,
   * escaneando o mesmo QR Code impresso, era redirecionado para o
   * acompanhamento do pedido de um cliente completamente diferente, de uma
   * visita anterior — não porque o QR Code aponta para o domínio errado,
   * mas porque a mesa nunca foi "encerrada" de verdade no banco.
   *
   * Correção: liberar a mesa agora cancela primeiro qualquer pedido ainda
   * aberto (mesmo laço sequencial já usado em `handleConfirmPayment`, só que
   * para "cancelled" em vez de "delivered" — cancelar é uma transição válida
   * a partir de qualquer status não-terminal, `lib/orders/status-transitions.ts`
   * não mudou). Preserva o comportamento existente de "liberar mesmo assim"
   * (a confirmação continua avisando e pedindo confirmação), só deixa de
   * abandonar dado no banco ao fazer isso.
   */
  async function handleReleaseTable() {
    if (isReleasingRef.current) return;
    isReleasingRef.current = true;

    setIsReleasing(true);
    setError(null);
    try {
      const stillOpenOrders = openOrders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");

      for (const order of stillOpenOrders) {
        const cancelResponse = await fetch(`/api/v1/orders/${order.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        });
        if (!cancelResponse.ok) {
          const cancelBody = await cancelResponse.json().catch(() => null);
          onOrdersChanged();
          throw new Error(
            cancelBody?.error?.message ?? "Não foi possível cancelar um dos pedidos abertos desta mesa.",
          );
        }
      }

      const response = await fetch(`/api/v1/tables/${table.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "livre" }),
      });
      const body = await response.json();
      if (!response.ok) {
        onOrdersChanged();
        setError(body?.error?.message ?? "Não foi possível liberar a mesa.");
        return;
      }
      toast.success("Mesa liberada");
      onOrdersChanged();
      onTableUpdated({ id: table.id, name: table.name, status: "livre", qrToken: table.qrToken });
      setConfirmingRelease(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível liberar a mesa.");
    } finally {
      setIsReleasing(false);
      isReleasingRef.current = false;
    }
  }

  const subtotal = openOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const itemCount = openOrders.reduce((sum, o) => sum + o.item_count, 0);
  const hasPendingOrder = openOrders.some((o) => o.status === "pending");
  const hasPreparingOrder = openOrders.some((o) => o.status === "preparing");
  const orderTimestamps = openOrders.map((o) => o.created_at);
  const openedAt = orderTimestamps.length > 0 ? orderTimestamps.reduce((a, b) => (a < b ? a : b)) : null;
  const lastOrderAt = orderTimestamps.length > 0 ? orderTimestamps.reduce((a, b) => (a > b ? a : b)) : null;

  // Sprint 13.10 — atendente em correria não pode precisar rolar pra achar
  // o pedido mais urgente. `pending` ("Enviar para cozinha", a ação mais
  // sensível ao tempo) sempre aparece primeiro na lista, antes de
  // `preparing`/outros — sem mudar nada além da ORDEM (mesmos dados, mesmo
  // card por pedido). `[...openOrders]` porque `.sort()` muta o array;
  // comparação por índice original preserva a ordem relativa dentro de
  // cada grupo (sort estável, garantido pela especificação do JS desde
  // ES2019 — não é um detalhe de implementação incerto).
  const sortedOpenOrders = useMemo(
    () =>
      [...openOrders].sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return 0;
      }),
    [openOrders],
  );

  // Sprint 13.10 — com 2+ pedidos abertos, cada card com a lista de itens
  // inteira empilha altura rápido, empurrando o botão de ação (o mais
  // urgente de achar) pra fora da primeira tela — exigia rolar pra
  // encontrar, atrito real reportado no uso corrido. Com só 1 pedido, o
  // espaço já sobra — mantém expandido, sem mudança de comportamento.
  const shouldSummarizeOrders = openOrders.length > 1;


  const cardState = deriveTableCardState(
    table.status,
    openOrders.length > 0 ? { totalAmount: subtotal, itemCount, lastOrderAt, hasPendingOrder, hasPreparingOrder } : null,
    alerts,
  );
  const isFilled = TABLE_CARD_FILLED_TONES.includes(cardState.tone);
  // Sprint UI-02 (2026-07-31): ver `TABLE_CARD_TONE_DARK_TEXT` em
  // `derive-table-card-state.ts` — `new_order` tem fundo claro
  // (`ds2-warning`), precisa de texto escuro em vez do branco genérico.
  const isDarkOnLight = TABLE_CARD_TONE_DARK_TEXT.includes(cardState.tone);

  // `focusRingClass`: mesmo raciocínio de `tables-manager.tsx` — usado em
  // elementos que não são `Button` (o link "Ver histórico completo");
  // `Button` já tem `focus-visible` nativo desde a migração DS2 do
  // componente, então onde este valor é passado para um `<Button>` é
  // redundante, não incorreto.
  const focusRingClass =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds2-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ds2-background";

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
        "fixed inset-x-0 bottom-0 top-auto m-0 max-h-[88vh] w-full overflow-hidden rounded-t-ds2-lg border-t border-ds2-border bg-ds2-surface p-0 text-ds2-foreground shadow-ds2-lg",
        "sm:inset-y-0 sm:left-auto sm:right-0 sm:bottom-0 sm:top-0 sm:m-0 sm:h-full sm:max-h-none sm:w-[420px] sm:rounded-none sm:rounded-l-ds2-lg sm:border-l sm:border-t-0 sm:shadow-ds2-lg",
        "backdrop:bg-black/50 backdrop:backdrop-blur-[2px]",
        "open:animate-sheet-up sm:open:animate-slide-in-right",
      )}
    >
      <div className="flex h-full max-h-[88vh] flex-col sm:max-h-none">
        <div
          className={cn(
            "flex flex-col gap-3 border-b border-ds2-border px-5 py-4",
            isFilled && TABLE_CARD_TONE_CLASSES[cardState.tone],
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1.5">
              <span className="font-numeric text-3xl font-bold leading-none tabular-nums text-ds2-foreground">
                {table.name}
              </span>
              <span
                className={cn(
                  "inline-flex w-fit items-center gap-1.5 rounded-ds2-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide",
                  isFilled
                    ? isDarkOnLight
                      ? "bg-ds2-warning-foreground/15 text-ds2-warning-foreground"
                      : "bg-white/20 text-white"
                    : "bg-ds2-surface-hover text-ds2-foreground-muted ring-1 ring-inset ring-ds2-border",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-ds2-full",
                    isFilled
                      ? isDarkOnLight
                        ? "bg-ds2-warning-foreground/70"
                        : "bg-white/70"
                      : TABLE_CARD_TONE_DOT_CLASSES[cardState.tone],
                  )}
                  aria-hidden
                />
                {cardState.label}
              </span>

              {/*
                Selo à parte do tom, para os dois coexistirem (mesa
                "Preparando" com pedido novo ainda em pending). Só aparece
                quando soma informação nova ao tom já mostrado acima.
                Contagem (não só "Pedido novo") pela mesma razão do tile:
                deixou de ser o destaque principal (isso é a animação do
                card na grade), aqui reforça de forma consistente.
              */}
              {cardState.hasUnprocessedOrders && cardState.tone !== "new_order" && (
                <span
                  className="inline-flex w-fit animate-pulse items-center gap-1.5 rounded-ds2-full bg-ds2-warning px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-ds2-warning-foreground"
                  title="Pedido novo aguardando envio para a cozinha"
                >
                  <Bell className="h-3 w-3" aria-hidden />
                  {(() => {
                    const pendingCount = openOrders.filter((o) => o.status === "pending").length;
                    return `${pendingCount} ${pendingCount === 1 ? "NOVO" : "NOVOS"}`;
                  })()}
                </span>
              )}

              {/*
                Sprint UI-01 (Migração DS2, 2026-07-31): mesmo selo do card
                na grade — "Chamando garçom" não é mais tom, é indicador
                independente. `ds2-primary` (verde), nunca `ds2-info` nem
                cor nova, por pedido explícito. Atender/resolver a chamada
                continua no corpo do drawer (`waiterCallAlert`, mais abaixo)
                — este selo é só o reforço visual no cabeçalho.
              */}
              {cardState.hasWaiterCall && (
                <span
                  className="inline-flex w-fit items-center gap-1.5 rounded-ds2-full bg-ds2-primary px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-ds2-primary-foreground"
                  title="Cliente chamando o garçom"
                >
                  <Hand className="h-3 w-3" aria-hidden />
                  Garçom
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Fechar"
              className={cn(
                isFilled &&
                  (isDarkOnLight
                    ? "text-ds2-warning-foreground hover:bg-ds2-warning-foreground/15 hover:text-ds2-warning-foreground"
                    : "text-white hover:bg-white/15 hover:text-white"),
                focusRingClass,
              )}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-end justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <span
                className={cn(
                  "text-xs",
                  isFilled ? (isDarkOnLight ? "text-ds2-warning-foreground/80" : "text-white/80") : "text-ds2-foreground-muted",
                )}
              >
                Valor atual
              </span>
              <span className="font-numeric text-2xl font-bold leading-tight tabular-nums text-ds2-foreground">
                {formatCurrency(subtotal)}
              </span>
            </div>
            {openedAt && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs",
                  isFilled ? (isDarkOnLight ? "text-ds2-warning-foreground/80" : "text-white/80") : "text-ds2-foreground-muted",
                )}
              >
                <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                aberta há {formatRelativeTimeShort(openedAt)}
              </span>
            )}
          </div>
        </div>

        {(waiterCallAlert || billRequestAlert) && (
          <div className="flex flex-col gap-2 border-b border-ds2-border px-5 py-3">
            {waiterCallAlert && (
              <Alert variant="info" className="items-center justify-between">
                <span className="font-medium">Chamando garçom · há {formatRelativeTimeShort(waiterCallAlert.createdAt)}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn("ml-3 shrink-0", focusRingClass)}
                  onClick={() => handleResolveAlert(waiterCallAlert.id)}
                  isLoading={resolvingAlertId === waiterCallAlert.id}
                >
                  Atendido
                </Button>
              </Alert>
            )}
            {billRequestAlert && (
              <Alert variant="destructive" className="items-center justify-between">
                <span className="font-medium">Conta solicitada · há {formatRelativeTimeShort(billRequestAlert.createdAt)}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn("ml-3 shrink-0", focusRingClass)}
                  onClick={() => handleResolveAlert(billRequestAlert.id)}
                  isLoading={resolvingAlertId === billRequestAlert.id}
                >
                  Conta entregue
                </Button>
              </Alert>
            )}
          </div>
        )}

        {openOrders.length > 0 && (
          <div className="grid grid-cols-2 gap-2 border-b border-ds2-border px-5 py-3">
            <div className="flex flex-col items-center gap-0.5 rounded-ds2-md bg-ds2-surface-hover py-2.5">
              <span className="font-numeric text-lg font-bold tabular-nums text-ds2-foreground">{openOrders.length}</span>
              <span className="text-xs text-ds2-foreground-muted">{openOrders.length === 1 ? "Pedido" : "Pedidos"}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 rounded-ds2-md bg-ds2-surface-hover py-2.5">
              <span className="font-numeric text-lg font-bold tabular-nums text-ds2-foreground">{itemCount}</span>
              <span className="text-xs text-ds2-foreground-muted">{itemCount === 1 ? "Item" : "Itens"}</span>
            </div>
          </div>
        )}

        {/* Sprint 13.4: `min-h-0` é a correção — sem ela, um item flex
            (`flex-1`) tem `min-height: auto` por padrão, o que impede ele
            de encolher menos que o próprio conteúdo. Com muitos pedidos
            na lista, isso fazia esta área CRESCER além da tela em vez de
            travar e rolar internamente — empurrando "Fechar conta" pra
            fora da vista, às vezes exigindo rolar o modal inteiro (comum
            passar despercebido em uso corrido). Com `min-h-0`, o
            `overflow-y-auto` passa a valer de verdade: cabeçalho e
            rodapé (abaixo) ficam sempre visíveis, só esta lista rola. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          {error && <Alert variant="destructive">{error}</Alert>}

          {openOrders.length > 0 && (
            <span className="text-xs font-semibold uppercase tracking-wide text-ds2-foreground-muted">
              Pedidos desta mesa
            </span>
          )}

          {openOrders.length === 0 ? (
            <p className="text-sm text-ds2-foreground-muted">Nenhum pedido em aberto nesta mesa.</p>
          ) : loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-ds2-foreground-muted" aria-hidden />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sortedOpenOrders.map((order) => {
                const detail = details[order.id];
                return (
                  <div
                    key={order.id}
                    className="flex flex-col gap-3 rounded-ds2-lg border border-ds2-border bg-ds2-surface p-3.5 shadow-ds2-sm"
                  >
                    <div className="flex items-center justify-between">
                      <AdminOrderStatusBadge status={order.status} />
                      <span className="inline-flex items-center gap-1 text-xs text-ds2-foreground-muted">
                        <Clock3 className="h-3 w-3 shrink-0" aria-hidden />
                        {formatRelativeTimeShort(order.created_at)}
                      </span>
                    </div>

                    {detail ? (
                      shouldSummarizeOrders ? (
                        // Sprint 13.10 — versão compacta: 1-2 linhas em vez
                        // de uma por item, pra caber mais pedido em tela
                        // sem rolar. Observação ("sem cebola" etc.) NUNCA
                        // fica escondida — informação crítica pra cozinha,
                        // sempre visível mesmo no resumo.
                        <div className="flex flex-col gap-1">
                          <p className="text-sm text-ds2-foreground">
                            {detail.items.map((item) => `${item.quantity}× ${item.name}`).join(", ")}
                          </p>
                          {detail.items
                            .filter((item) => item.notes)
                            .map((item) => (
                              <span
                                key={item.id}
                                className="flex items-center gap-1 text-xs italic text-ds2-foreground-muted"
                              >
                                <StickyNote className="h-3 w-3 shrink-0" aria-hidden />
                                {item.name}: {item.notes}
                              </span>
                            ))}
                        </div>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {detail.items.map((item) => (
                            <li key={item.id} className="flex flex-col gap-0.5">
                              <div className="flex items-center justify-between gap-2 text-sm">
                                <span className="flex items-center gap-2 text-ds2-foreground">
                                  <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-ds2-sm bg-ds2-surface-hover px-1 font-numeric text-xs font-semibold text-ds2-foreground-muted">
                                    {item.quantity}×
                                  </span>
                                  {item.name}
                                </span>
                                <span className="font-numeric font-medium text-ds2-foreground-muted">
                                  {formatCurrency(item.price * item.quantity)}
                                </span>
                              </div>
                              {item.notes && (
                                <span className="flex items-center gap-1 pl-7 text-xs italic text-ds2-foreground-muted">
                                  <StickyNote className="h-3 w-3 shrink-0" aria-hidden />
                                  {item.notes}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )
                    ) : (
                      <p className="text-xs text-ds2-foreground-muted">Itens indisponíveis.</p>
                    )}

                    <div className="flex items-center justify-between border-t border-ds2-border pt-2.5">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-ds2-foreground-muted">
                        <Receipt className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        Subtotal
                      </span>
                      <span className="font-numeric text-base font-bold tabular-nums text-ds2-foreground">
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
                        className={cn("w-full justify-center", focusRingClass)}
                      >
                        <ChefHat className="h-3.5 w-3.5" />
                        Enviar para cozinha
                      </Button>
                    )}

                    {/* Sprint "Simplificação do Fluxo de Status" (2026-07-30): vai direto preparing→delivered. */}
                    {order.status === "preparing" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleMarkDelivered(order.id)}
                        isLoading={updatingOrderId === order.id}
                        className={cn("w-full justify-center", focusRingClass)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Finalizar pedido
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

        <div className="flex flex-col gap-2 border-t border-ds2-border px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ds2-foreground-muted">Total da mesa</span>
            <span className="font-numeric text-lg font-bold tabular-nums text-ds2-foreground">{formatCurrency(subtotal)}</span>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className={cn("flex-1", focusRingClass)}
              onClick={() => window.print()}
              disabled={openOrders.length === 0}
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
            <Button
              type="button"
              variant="outline"
              className={cn("flex-1", focusRingClass)}
              onClick={() => setConfirmingRelease(true)}
              disabled={isReleasing}
            >
              Liberar mesa
            </Button>
          </div>

          <Button
            type="button"
            onClick={() => setCloseBillModalOpen(true)}
            disabled={!allDelivered}
            title={!allDelivered ? "Só é possível finalizar quando todos os pedidos estiverem finalizados" : undefined}
            className={focusRingClass}
          >
            {/* Item 3 do checklist do fluxo operacional das mesas: mesmo
                botão de sempre — só o rótulo muda para comunicar "esta é a
                etapa final" assim que todos os pedidos já estiverem
                finalizados. Sprint "Fechamento de Conta com Registro de
                Venda": agora abre o modal de fechamento em vez de fechar
                direto. */}
            {allDelivered && <CheckCircle2 className="h-4 w-4" />}
            {allDelivered ? "Finalizar atendimento" : "Fechar conta"}
          </Button>
          {!allDelivered && openOrders.length > 0 && (
            <p className="text-center text-xs text-ds2-foreground-muted">
              Ainda há pedido{openOrders.length > 1 ? "s" : ""} em preparo — finalizar libera quando tudo estiver finalizado.
            </p>
          )}

          {openOrders.length > 0 && (
            <Link
              href={ROUTES.pedidoDetalhe(openOrders[0]!.id)}
              className={cn("rounded-ds2-sm text-center text-xs font-medium text-ds2-primary hover:underline", focusRingClass)}
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

      <CloseBillModal
        open={closeBillModalOpen}
        table={table}
        acceptedPaymentMethods={acceptedPaymentMethods}
        onCancel={() => {
          setCloseBillModalOpen(false);
          setCloseBillError(null);
        }}
        onConfirm={handleConfirmPayment}
        isSubmitting={isClosingBill}
        error={closeBillError}
      />
    </dialog>
  );
}
