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

// Formas locais dos dois endpoints que este modal consulta — só os campos
// realmente usados aqui, não os DTOs inteiros de `orders-list.tsx`.
interface OrderSummaryRow {
  id: string;
  table: { id: string };
  created_at: string;
}
interface OrderDetailRow {
  id: string;
  items: { name: string; quantity: number; price: number }[];
}

interface CloseBillModalProps {
  open: boolean;
  table: TableEntity;
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

function consolidate(orders: OrderDetailRow[]): ConsolidatedLine[] {
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
 * produto — dado desatualizado numa tela financeira. Agora o modal não
 * recebe mais `openOrders`/`details` nenhum: ao abrir, busca sozinho, na
 * hora, direto da API (`GET /api/v1/orders` + `GET /api/v1/orders/{id}`
 * por pedido encontrado) — os mesmos dois endpoints estáveis de sempre,
 * só chamados no momento certo em vez de reaproveitar estado antigo.
 */
export function CloseBillModal({ open, table, onCancel, onConfirm, isSubmitting, error }: CloseBillModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderDetailRow[]>([]);
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const now = useMemo(() => new Date().toISOString(), [open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setSelectedMethod(null);

    async function loadOpenOrdersForTable() {
      // 1) Lista de pedidos ainda ativos do restaurante inteiro (mesmo
      //    endpoint que a tela de Pedidos e o Painel de Mesas já usam) —
      //    filtra pra esta mesa no cliente, já que o endpoint não tem
      //    `?table_id=` (não é necessário criar um novo endpoint só pra
      //    isso: o volume de pedidos ativos por restaurante é pequeno).
      const listResponse = await fetch("/api/v1/orders?status=pending,preparing,ready&per_page=100");
      const listBody = (await listResponse.json()) as ApiSuccess<OrderSummaryRow[]> | { error?: { message?: string } };
      if (!listResponse.ok) {
        throw new Error("error" in listBody ? (listBody.error?.message ?? "Não foi possível carregar a comanda.") : "Não foi possível carregar a comanda.");
      }

      const summaries = (listBody as ApiSuccess<OrderSummaryRow[]>).data.filter((o) => o.table.id === table.id);

      // 2) Detalhe (com itens) de cada um — mesmo endpoint que o Drawer já
      //    usava antes, só que a lista de partida agora é sempre fresca.
      const details = await Promise.all(
        summaries.map((summary) =>
          fetch(`/api/v1/orders/${summary.id}`)
            .then((r) => r.json())
            .then((body: ApiSuccess<OrderDetailRow>) => body.data),
        ),
      );

      if (cancelled) return;

      setOrders(details);
      setOpenedAt(
        summaries.reduce<string | null>(
          (min, o) => (min === null || o.created_at < min ? o.created_at : min),
          null,
        ),
      );
    }

    loadOpenOrdersForTable()
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
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted-foreground">Aberta às</span>
                <span className="text-sm font-medium text-foreground">
                  {openedAt
                    ? new Date(openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-muted-foreground">Agora</span>
                <span className="text-sm font-medium text-foreground">
                  {new Date(now).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="col-span-2 flex items-center gap-1.5 border-t border-border pt-2 text-sm text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Tempo de permanência:{" "}
                <span className="font-medium text-foreground">
                  {openedAt ? formatDurationBetween(openedAt, now) : "—"}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Produtos consumidos
              </span>
              {lines.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3.5 py-4 text-center text-sm text-muted-foreground">
                  Nenhum produto encontrado para esta mesa.
                </p>
              ) : (
                <div className="flex max-h-56 flex-col overflow-y-auto rounded-xl border border-border">
                  {lines.map((line: ConsolidatedLine, index: number) => (
                    <div
                      key={line.key}
                      className={cn(
                        "flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm",
                        index > 0 && "border-t border-border",
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-muted px-1 font-numeric text-[11px] font-semibold text-muted-foreground">
                          {line.quantity}×
                        </span>
                        <span className="truncate text-foreground">{line.name}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-xs text-muted-foreground">{formatCurrency(line.unitPrice)} un.</span>
                        <span className="font-numeric font-semibold tabular-nums text-foreground">
                          {formatCurrency(line.unitPrice * line.quantity)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3.5 py-3">
              <span className="text-sm font-semibold text-foreground">Valor total</span>
              <span className="font-numeric text-xl font-bold tabular-nums text-foreground">
                {formatCurrency(total)}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Forma de pagamento
              </span>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHOD_OPTIONS.map((option) => {
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
                        "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors duration-150",
                        isSelected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-surface text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("h-5 w-5", isSelected && "text-primary")} aria-hidden />
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
