"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, Clock3, CreditCard, QrCode, Wallet } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDurationBetween } from "@/lib/format";
import { PAYMENT_METHOD_VALUES } from "@/lib/validations/tables";
import type { ApiSuccess } from "@/types/api";
import type { Table as TableEntity } from "@/types/domain";

type PaymentMethod = (typeof PAYMENT_METHOD_VALUES)[number];

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string; icon: typeof QrCode }[] = [
  { value: "pix", label: "PIX", icon: QrCode },
  { value: "credit_card", label: "Cartão de Crédito", icon: CreditCard },
  { value: "debit_card", label: "Cartão de Débito", icon: Wallet },
  { value: "cash", label: "Dinheiro", icon: Banknote },
];

// Forma da resposta de `GET /api/v1/tables/{id}/close-bill` — só os campos
// realmente usados aqui.
interface OpenSessionResponse {
  session_id: string;
  opened_at: string;
  orders: { id: string; status: string; items: { name: string; quantity: number; price: number }[] }[];
}

interface CloseBillModalProps {
  open: boolean;
  table: TableEntity;
  /** Fase 4B.1 (2026-08-10) — já normalizado (`resolveAcceptedPaymentMethods`, nunca vazio). Filtra `PAYMENT_METHOD_OPTIONS`; a validação de verdade é no backend (`close-bill/route.ts`). */
  acceptedPaymentMethods: PaymentMethod[];
  onCancel: () => void;
  onConfirm: (paymentMethod: PaymentMethod) => void;
  isSubmitting: boolean;
  error?: string | null;
}

/** Um produto consolidado na comanda inteira — mesmo produto/preço em pedidos diferentes vira uma linha só, com a quantidade somada. */
interface ConsolidatedLine {
  key: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

function consolidate(orders: OpenSessionResponse["orders"]): ConsolidatedLine[] {
  const byKey = new Map<string, ConsolidatedLine>();
  for (const order of orders) {
    for (const item of order.items) {
      const key = `${item.name}__${item.price}`;
      const existing = byKey.get(key);
      if (existing) existing.quantity += item.quantity;
      else byKey.set(key, { key, name: item.name, quantity: item.quantity, unitPrice: item.price });
    }
  }
  return Array.from(byKey.values());
}

/**
 * Tela de fechamento de conta (Sprint "Fechamento de Conta com Registro de
 * Venda", 2026-07-29) — passo entre clicar em "Fechar conta" e a mesa ser
 * liberada de fato.
 *
 * Sprint "Correção — Fechamento de Conta Não-Atômico" (2026-07-30,
 * seguinte): antes, este modal recebia `openOrders`/`details` como props —
 * o mesmo estado que `TablesManager` carrega uma vez e mantém "vivo" só
 * via Realtime (canal já registrado como instável). Uma comanda fechada há
 * pouco tempo por outro cliente/aba, ou pedida entre a última atualização
 * do painel e a abertura deste modal, aparecia com R$ 0,00 e nenhum
 * produto — dado desatualizado numa tela financeira. Modal passou a buscar
 * sozinho ao abrir, em vez de depender de props.
 *
 * Sprint "Correção — Fonte Única de Verdade no Carregamento do Modal"
 * (2026-07-30, seguinte): a busca acima ainda filtrava por
 * `status=pending,preparing,ready` (`GET /api/v1/orders`) — diverge de
 * como `close_table_bill` decide o que pertence à comanda (pela
 * `order_session` aberta, não pelo status do pedido). Um pedido já
 * `delivered` (ex.: garçom marcou "entregue" na tela de Pedidos bem antes
 * de "Fechar conta" ser clicado — um fluxo normal do dia a dia) ficava de
 * fora da consulta, mesmo sendo parte legítima da comanda — daí a tela
 * aparecer vazia mesmo com a comanda tendo produtos de verdade. Agora usa
 * `GET /api/v1/tables/{id}/close-bill` (rota nova, só leitura, mesmo
 * arquivo da rota de fechamento): localiza a `order_session` aberta da
 * mesa exatamente como `close_table_bill` faz, e devolve todos os pedidos
 * vinculados a ela, de qualquer status — a mesma fonte de verdade dos
 * dois lados do fluxo.
 */
export function CloseBillModal({
  open,
  table,
  acceptedPaymentMethods,
  onCancel,
  onConfirm,
  isSubmitting,
  error,
}: CloseBillModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  // Só filtra quais aparecem — a lista/ordem/rótulo/ícone de cada opção
  // continuam vindo de `PAYMENT_METHOD_OPTIONS`, sem duplicar nada.
  const visibleOptions = PAYMENT_METHOD_OPTIONS.filter((option) => acceptedPaymentMethods.includes(option.value));
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OpenSessionResponse["orders"]>([]);
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const now = useMemo(() => new Date().toISOString(), [open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setSelectedMethod(null);

    async function loadOpenSessionForTable() {
      // Mesma fonte de verdade que `close_table_bill` usa pra decidir o
      // que pertence à comanda: a `order_session` aberta da mesa — não o
      // status dos pedidos (um pedido pode legitimamente já estar
      // `delivered`, ex.: garçom já marcou "entregue" na tela de Pedidos,
      // bem antes de "Fechar conta" ser clicado, e ainda assim ser parte
      // da comanda sendo fechada agora).
      const response = await fetch(`/api/v1/tables/${table.id}/close-bill`);
      const body = (await response.json()) as ApiSuccess<OpenSessionResponse> | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(
          "error" in body ? (body.error?.message ?? "Não foi possível carregar a comanda.") : "Não foi possível carregar a comanda.",
        );
      }

      if (cancelled) return;

      const { opened_at, orders: sessionOrders } = (body as ApiSuccess<OpenSessionResponse>).data;
      setOrders(sessionOrders);
      setOpenedAt(opened_at);
    }

    loadOpenSessionForTable()
      .catch(() => {
        if (!cancelled) setLoadError("Não foi possível carregar os dados da comanda. Tente novamente.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, table.id]);

  const lines = useMemo(() => consolidate(orders), [orders]);
  const total = lines.reduce((sum: number, line: ConsolidatedLine) => sum + line.unitPrice * line.quantity, 0);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Fechar conta"
      description={`Mesa ${table.name}`}
      className="max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => selectedMethod && onConfirm(selectedMethod)}
            disabled={!selectedMethod || isLoading || Boolean(loadError)}
            isLoading={isSubmitting}
          >
            Confirmar pagamento
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        {error && <Alert variant="destructive">{error}</Alert>}
        {loadError && <Alert variant="destructive">{loadError}</Alert>}

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 rounded-ds2-md bg-ds2-surface-hover p-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-ds2-foreground-muted">Aberta às</span>
                <span className="text-sm font-medium text-ds2-foreground">
                  {openedAt
                    ? new Date(openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-ds2-foreground-muted">Agora</span>
                <span className="text-sm font-medium text-ds2-foreground">
                  {new Date(now).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="col-span-2 flex items-center gap-1.5 border-t border-ds2-border pt-2 text-sm text-ds2-foreground-muted">
                <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Tempo de permanência:{" "}
                <span className="font-medium text-ds2-foreground">
                  {openedAt ? formatDurationBetween(openedAt, now) : "—"}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ds2-foreground-muted">
                Produtos consumidos
              </span>
              {lines.length === 0 ? (
                <p className="rounded-ds2-md border border-dashed border-ds2-border px-3.5 py-4 text-center text-sm text-ds2-foreground-muted">
                  Nenhum produto encontrado para esta mesa.
                </p>
              ) : (
                <div className="flex max-h-56 flex-col overflow-y-auto rounded-ds2-md border border-ds2-border">
                  {lines.map((line: ConsolidatedLine, index: number) => (
                    <div
                      key={line.key}
                      className={cn(
                        "flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm",
                        index > 0 && "border-t border-ds2-border",
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-ds2-sm bg-ds2-surface-hover px-1 font-numeric text-xs font-semibold text-ds2-foreground-muted">
                          {line.quantity}×
                        </span>
                        <span className="truncate text-ds2-foreground">{line.name}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-xs text-ds2-foreground-muted">{formatCurrency(line.unitPrice)} un.</span>
                        <span className="font-numeric font-semibold tabular-nums text-ds2-foreground">
                          {formatCurrency(line.unitPrice * line.quantity)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-ds2-md bg-ds2-surface-hover px-3.5 py-3">
              <span className="text-sm font-semibold text-ds2-foreground">Valor total</span>
              <span className="font-numeric text-xl font-bold tabular-nums text-ds2-foreground">
                {formatCurrency(total)}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ds2-foreground-muted">
                Forma de pagamento
              </span>
              <div className="grid grid-cols-2 gap-2">
                {visibleOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = selectedMethod === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSelectedMethod(option.value)}
                      aria-pressed={isSelected}
                      disabled={isSubmitting}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-ds2-md border p-3 text-center transition-colors duration-150",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds2-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ds2-background",
                        isSelected
                          ? "border-ds2-primary bg-ds2-primary/10 text-ds2-foreground"
                          : "border-ds2-border bg-ds2-surface text-ds2-foreground-muted hover:border-ds2-foreground/20 hover:text-ds2-foreground",
                      )}
                    >
                      <Icon className={cn("h-5 w-5", isSelected && "text-ds2-primary")} aria-hidden />
                      <span className="text-xs font-medium">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
