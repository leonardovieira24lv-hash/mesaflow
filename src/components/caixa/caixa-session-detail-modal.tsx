"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import { formatCurrency, formatDurationBetween } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, type CashierSessionDetail } from "@/lib/cashier/queries";
import type { ApiError, ApiSuccess } from "@/types/api";

interface CaixaSessionDetailModalProps {
  sessionId: string | null;
  onClose: () => void;
}

/**
 * Detalhe de uma venda (Sprint "Painel de Caixa", 2026-07-30) — abre ao
 * tocar numa linha da tabela. Busca sob demanda (`GET /api/v1/cashier/{id}`)
 * em vez de carregar o detalhe de toda comanda listada de uma vez —
 * a lista já tem tudo que os cards/tabela precisam; o detalhe completo
 * (itens consumidos) só é buscado quando alguém realmente abre.
 */
export function CaixaSessionDetailModal({ sessionId, onClose }: CaixaSessionDetailModalProps) {
  const [detail, setDetail] = useState<CashierSessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(`/api/v1/cashier/${sessionId}`)
      .then(async (response) => {
        const body = (await response.json()) as ApiSuccess<CashierSessionDetail> | ApiError;
        if (cancelled) return;
        if (!response.ok) {
          setError("error" in body ? (body.error?.message ?? "Não foi possível carregar esta venda.") : "Não foi possível carregar esta venda.");
          return;
        }
        setDetail((body as ApiSuccess<CashierSessionDetail>).data);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <Modal
      open={sessionId !== null}
      onClose={onClose}
      title={detail ? `Mesa ${detail.tableName}` : "Detalhes da venda"}
      description={detail ? new Date(detail.closedAt).toLocaleDateString("pt-BR") : undefined}
      className="max-w-lg"
    >
      <div className="flex flex-col gap-5 pb-6">
        {error && <Alert variant="destructive">{error}</Alert>}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        )}

        {detail && !isLoading && (
          <>
            <div className="grid grid-cols-2 gap-2 rounded-ds2-md bg-ds2-surface-hover/50 p-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-ds2-foreground-muted">Abertura</span>
                <span className="text-sm font-medium text-ds2-foreground">
                  {new Date(detail.openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-ds2-foreground-muted">Fechamento</span>
                <span className="text-sm font-medium text-ds2-foreground">
                  {new Date(detail.closedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="col-span-2 flex items-center gap-1.5 border-t border-ds2-border pt-2 text-sm text-ds2-foreground-muted">
                <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Tempo de permanência:{" "}
                <span className="font-medium text-ds2-foreground">
                  {formatDurationBetween(detail.openedAt, detail.closedAt)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ds2-foreground-muted">
                Produtos consumidos
              </span>
              <Card className="flex flex-col overflow-hidden p-0">
                {detail.items.map((item: CashierSessionDetail["items"][number], index: number) => (
                  <div
                    key={`${item.name}-${item.unitPrice}`}
                    className={
                      "flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm" +
                      (index > 0 ? " border-t border-ds2-border" : "")
                    }
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-ds2-sm bg-ds2-surface-hover px-1 font-numeric text-xs font-semibold text-ds2-foreground-muted">
                        {item.quantity}×
                      </span>
                      <span className="truncate text-ds2-foreground">{item.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-ds2-foreground-muted">{formatCurrency(item.unitPrice)} un.</span>
                      <span className="font-numeric font-semibold tabular-nums text-ds2-foreground">
                        {formatCurrency(item.lineTotal)}
                      </span>
                    </div>
                  </div>
                ))}
              </Card>
            </div>

            <div className="flex items-center justify-between rounded-ds2-md bg-ds2-surface-hover/50 px-3.5 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-ds2-foreground">Valor final</span>
                <span className="text-xs text-ds2-foreground-muted">
                  {detail.paymentMethod ? PAYMENT_METHOD_LABELS[detail.paymentMethod] : "Forma de pagamento não registrada"}
                </span>
              </div>
              <span className="font-numeric text-xl font-bold tabular-nums text-ds2-foreground">
                {formatCurrency(detail.totalAmount)}
              </span>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
