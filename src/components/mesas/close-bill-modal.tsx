"use client";

import { useMemo, useState } from "react";
import { Banknote, Clock3, CreditCard, QrCode, Wallet } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDurationBetween } from "@/lib/format";
import { PAYMENT_METHOD_VALUES } from "@/lib/validations/tables";
import type { OrderListRow } from "@/components/pedidos/orders-list";
import type { Table as TableEntity } from "@/types/domain";

type PaymentMethod = (typeof PAYMENT_METHOD_VALUES)[number];

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string; icon: typeof QrCode }[] = [
  { value: "pix", label: "PIX", icon: QrCode },
  { value: "credit_card", label: "Cartão de Crédito", icon: CreditCard },
  { value: "debit_card", label: "Cartão de Débito", icon: Wallet },
  { value: "cash", label: "Dinheiro", icon: Banknote },
];

interface OrderDetailItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
}

interface CloseBillModalProps {
  open: boolean;
  table: TableEntity;
  openOrders: OrderListRow[];
  details: Record<string, { items: OrderDetailItem[] }>;
  openedAt: string | null;
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

function consolidateItems(
  openOrders: OrderListRow[],
  details: Record<string, { items: OrderDetailItem[] }>,
): ConsolidatedLine[] {
  const byKey = new Map<string, ConsolidatedLine>();

  for (const order of openOrders) {
    const items = details[order.id]?.items ?? [];
    for (const item of items) {
      const key = `${item.name}__${item.price}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        byKey.set(key, { key, name: item.name, quantity: item.quantity, unitPrice: item.price });
      }
    }
  }

  return Array.from(byKey.values());
}

/**
 * Tela de fechamento de conta (Sprint "Fechamento de Conta com Registro de
 * Venda", 2026-07-29) — passo novo entre clicar em "Fechar conta" e a mesa
 * ser liberada de fato. Antes, o botão fazia tudo de uma vez, sem
 * confirmação nem registro de forma de pagamento; agora abre esta tela
 * primeiro, com o resumo completo da comanda e a escolha da forma de
 * pagamento — só a partir da confirmação aqui é que `TableDrawer` dispara
 * o fechamento de verdade (`handleConfirmPayment`).
 *
 * Puramente apresentacional: recebe os dados já carregados pelo
 * `TableDrawer` (nada de fetch próprio) e devolve a forma de pagamento
 * escolhida via `onConfirm` — toda a orquestração (marcar pedidos como
 * entregues, chamar `close-bill`, liberar a mesa) continua centralizada no
 * componente pai, junto dos outros handlers que já existem lá.
 */
export function CloseBillModal({
  open,
  table,
  openOrders,
  details,
  openedAt,
  onCancel,
  onConfirm,
  isSubmitting,
  error,
}: CloseBillModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);

  const lines = useMemo(() => consolidateItems(openOrders, details), [openOrders, details]);
  const total = lines.reduce((sum: number, line: ConsolidatedLine) => sum + line.unitPrice * line.quantity, 0);
  const now = useMemo(() => new Date().toISOString(), [open]);

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
            disabled={!selectedMethod}
            isLoading={isSubmitting}
          >
            Confirmar pagamento
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        {error && <Alert variant="destructive">{error}</Alert>}

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] text-muted-foreground">Aberta às</span>
            <span className="text-sm font-medium text-foreground">
              {openedAt ? new Date(openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
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
            <span className="font-medium text-foreground">{openedAt ? formatDurationBetween(openedAt, now) : "—"}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Produtos consumidos
          </span>
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
        </div>

        <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3.5 py-3">
          <span className="text-sm font-semibold text-foreground">Valor total</span>
          <span className="font-numeric text-xl font-bold tabular-nums text-foreground">{formatCurrency(total)}</span>
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
      </div>
    </Modal>
  );
}
