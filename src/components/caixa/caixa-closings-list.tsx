"use client";

import { useEffect, useRef, useState } from "react";
import { Archive } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/format";
import type { CashierClosingsResult } from "@/lib/cashier/queries";
import type { ApiError, ApiSuccess } from "@/types/api";

const PERIOD_TYPE_LABELS: Record<string, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  custom: "Período personalizado",
};

/**
 * Histórico de fechamentos de caixa (feature "Histórico de Fechamentos",
 * 2026-08-14) — cada linha é um clique passado em "Fechar Caixa"
 * (`cashier_closings`, gravada desde a Sprint 2, nunca lida de volta até
 * agora). Somente leitura, sem nenhuma ação — não altera pedido/mesa/
 * caixa ao vivo, só consulta o que já foi fechado. Busca sozinho, sob
 * demanda, quando a aba "Fechamentos" é aberta (não busca de propósito
 * enquanto a aba "Ao vivo" está ativa — ver `caixa-manager.tsx`).
 */
export function CaixaClosingsList() {
  const [data, setData] = useState<CashierClosingsResult | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestRequestId = useRef(0);

  useEffect(() => {
    const requestId = ++latestRequestId.current;
    setIsLoading(true);
    setError(null);

    fetch(`/api/v1/cashier/closings?page=${page}`)
      .then(async (response) => {
        const body: ApiSuccess<CashierClosingsResult> | ApiError = await response.json();
        if (requestId !== latestRequestId.current) return;

        if (!response.ok || "error" in body) {
          setError(("error" in body && body.error?.message) || "Não foi possível carregar o histórico.");
          return;
        }
        setData(body.data);
      })
      .catch(() => {
        if (requestId !== latestRequestId.current) return;
        setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
      })
      .finally(() => {
        if (requestId === latestRequestId.current) setIsLoading(false);
      });
  }, [page]);

  if (error) {
    return <Alert variant="destructive">{error}</Alert>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="relative overflow-hidden">
        <CardContent className="p-0">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-ds2-surface/70 backdrop-blur-[1px]">
              <Spinner className="h-6 w-6" />
            </div>
          )}

          {data && data.closings.length === 0 ? (
            <EmptyState
              icon={Archive}
              title="Nenhum fechamento ainda"
              description="Assim que você fechar o caixa pela primeira vez, ele aparece aqui."
              className="border-0"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Fechado em</TableHead>
                  <TableHead>Faturamento</TableHead>
                  <TableHead>Ticket médio</TableHead>
                  <TableHead>Comandas</TableHead>
                  <TableHead>Mesas atendidas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.closings ?? []).map((closing) => (
                  <TableRow key={closing.id}>
                    <TableCell className="font-medium text-ds2-foreground">
                      {PERIOD_TYPE_LABELS[closing.periodType] ?? closing.periodType}
                    </TableCell>
                    <TableCell className="text-ds2-foreground-muted">
                      {new Date(closing.closedAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="font-numeric font-semibold text-ds2-foreground">
                      {formatCurrency(closing.revenue)}
                    </TableCell>
                    <TableCell className="font-numeric text-ds2-foreground-muted">
                      {formatCurrency(closing.averageTicket)}
                    </TableCell>
                    <TableCell className="font-numeric text-ds2-foreground-muted">
                      {closing.closedSessionsCount}
                    </TableCell>
                    <TableCell className="font-numeric text-ds2-foreground-muted">
                      {closing.tablesServedCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && data.meta.totalPages > 1 && (
        <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}
