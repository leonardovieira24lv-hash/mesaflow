"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Banknote, ClipboardList, LayoutGrid, Lock, Receipt, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { formatCurrency, formatDurationBetween } from "@/lib/format";
import { CASHIER_PERIOD_VALUES, type CashierPeriod } from "@/lib/validations/cashier";
import { PAYMENT_METHOD_LABELS, type CashierListResult, type ClosedSessionRow } from "@/lib/cashier/queries";
import { CaixaSessionDetailModal } from "@/components/caixa/caixa-session-detail-modal";
import type { ApiError, ApiSuccess } from "@/types/api";

const PERIOD_LABELS: Record<CashierPeriod, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  custom: "Período personalizado",
};

interface CaixaManagerProps {
  initialData: CashierListResult;
  initialPeriod: CashierPeriod;
}

/**
 * Painel de Caixa (Sprint "Painel de Caixa", 2026-07-30) — histórico
 * permanente de comandas finalizadas, sem nenhuma ação de escrita nesta
 * tela (somente leitura: nada aqui altera mesa/pedido/cardápio). Cards de
 * resumo + tabela vêm sempre do mesmo `GET /api/v1/cashier`, então nunca
 * divergem entre si.
 *
 * Estrutura pensada para as funcionalidades futuras já anunciadas
 * (fechamento de caixa, relatórios, exportação PDF/Excel, dashboard
 * financeiro) sem implementá-las agora: `getCashierData`
 * (`lib/cashier/queries.ts`) já devolve exatamente o recorte de dados que
 * qualquer uma delas vai precisar — um botão de exportar, quando existir,
 * chama a mesma função/rota, só trocando o formato da resposta.
 */
export function CaixaManager({ initialData, initialPeriod }: CaixaManagerProps) {
  const [period, setPeriod] = useState<CashierPeriod>(initialPeriod);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<CashierListResult>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  // Evita que uma requisição mais lenta (ex.: filtro trocado duas vezes
  // rápido) sobrescreva o estado com uma resposta desatualizada — só a
  // resposta da requisição mais recente é aplicada.
  const latestRequestId = useRef(0);

  // Fechamento de Caixa (Sprint "Painel de Caixa" — etapa 1, fluxo visual):
  // nesta etapa não há persistência nem histórico, só o modal de
  // confirmação com os dados reais do período já carregado e um campo de
  // observações local. `handleConfirmClosing` só fecha o modal e avisa via
  // toast — a gravação em si fica para a próxima etapa.
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [closingObservations, setClosingObservations] = useState("");

  function handleConfirmClosing() {
    setIsClosingModalOpen(false);
    setClosingObservations("");
    toast.success("Fluxo preparado. A persistência será implementada na próxima etapa.");
  }

  const fetchData = useCallback(async () => {
    if (period === "custom" && (!customStart || !customEnd)) return;

    const requestId = ++latestRequestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period, page: String(page), per_page: "20" });
      if (period === "custom") {
        params.set("start_date", customStart);
        params.set("end_date", customEnd);
      }
      if (search.trim()) params.set("search", search.trim());

      const response = await fetch(`/api/v1/cashier?${params.toString()}`);
      const body = (await response.json()) as ApiSuccess<CashierListResult> | ApiError;
      if (requestId !== latestRequestId.current) return;

      if (!response.ok) {
        setError("error" in body ? (body.error?.message ?? "Não foi possível carregar o caixa.") : "Não foi possível carregar o caixa.");
        return;
      }

      setData((body as ApiSuccess<CashierListResult>).data);
    } catch {
      if (requestId === latestRequestId.current) {
        setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
      }
    } finally {
      if (requestId === latestRequestId.current) setIsLoading(false);
    }
  }, [period, customStart, customEnd, search, page]);

  // Refaz a busca sempre que filtro/página mudam — exceto na primeira
  // renderização, que já usa `initialData` vindo do servidor.
  const [isFirstRender, setIsFirstRender] = useState(true);
  useEffect(() => {
    if (isFirstRender) {
      setIsFirstRender(false);
      return;
    }
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchData já depende de tudo que importa; só não deve rodar no primeiro render
  }, [period, customStart, customEnd, page]);

  // Busca por texto tem debounce próprio — não dispara a cada tecla.
  useEffect(() => {
    if (isFirstRender) return;
    const timeout = setTimeout(() => {
      setPage(1);
      void fetchData();
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só o texto de busca deve disparar este debounce
  }, [search]);

  function handlePeriodChange(next: CashierPeriod) {
    setPeriod(next);
    setPage(1);
  }

  const { summary, sessions, meta } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setIsClosingModalOpen(true)}>
          <Lock className="h-4 w-4" aria-hidden />
          Fechar Caixa
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard icon={Banknote} label="Faturamento do período" value={formatCurrency(summary.revenue)} />
        <SummaryCard icon={Receipt} label="Comandas fechadas" value={String(summary.closedSessionsCount)} />
        <SummaryCard icon={ClipboardList} label="Ticket médio" value={formatCurrency(summary.averageTicket)} />
        <SummaryCard icon={LayoutGrid} label="Mesas atendidas" value={String(summary.tablesServedCount)} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={period}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => handlePeriodChange(e.target.value as CashierPeriod)}
            className="h-9 w-auto min-w-[9rem]"
          >
            {CASHIER_PERIOD_VALUES.map((value) => (
              <option key={value} value={value}>
                {PERIOD_LABELS[value]}
              </option>
            ))}
          </Select>

          {period === "custom" && (
            <>
              <Input
                type="date"
                value={customStart}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomStart(e.target.value)}
                className="h-9 w-auto"
                aria-label="Data inicial"
              />
              <Input
                type="date"
                value={customEnd}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomEnd(e.target.value)}
                className="h-9 w-auto"
                aria-label="Data final"
              />
            </>
          )}
        </div>

        <Input
          value={search}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          placeholder="Buscar por mesa ou nº da comanda"
          leadingIcon={<Search className="h-4 w-4" />}
          className="sm:w-72"
        />
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      <Card className="relative overflow-hidden">
        <CardContent className="p-0">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-ds2-surface/70 backdrop-blur-[1px]">
              <Spinner className="h-6 w-6" />
            </div>
          )}

          {sessions.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Nenhuma venda encontrada"
              description="Nenhuma comanda finalizada no período/busca selecionados."
              className="border-0"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mesa</TableHead>
                  <TableHead>Comanda</TableHead>
                  <TableHead>Abertura</TableHead>
                  <TableHead>Fechamento</TableHead>
                  <TableHead>Permanência</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session: ClosedSessionRow) => (
                  <TableRow
                    key={session.id}
                    onClick={() => setSelectedSessionId(session.id)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium text-ds2-foreground">{session.tableName}</TableCell>
                    <TableCell className="font-numeric text-ds2-foreground-muted">
                      #{session.id.slice(0, 8).toUpperCase()}
                    </TableCell>
                    <TableCell>
                      {new Date(session.openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell>
                      {new Date(session.closedAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>{formatDurationBetween(session.openedAt, session.closedAt)}</TableCell>
                    <TableCell className="font-numeric font-semibold text-ds2-foreground">
                      {formatCurrency(session.totalAmount)}
                    </TableCell>
                    <TableCell>
                      {session.paymentMethod ? PAYMENT_METHOD_LABELS[session.paymentMethod] : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="success">Finalizada</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />

      <CaixaSessionDetailModal sessionId={selectedSessionId} onClose={() => setSelectedSessionId(null)} />

      <CaixaClosingModal
        open={isClosingModalOpen}
        onClose={() => setIsClosingModalOpen(false)}
        revenue={summary.revenue}
        closedSessionsCount={summary.closedSessionsCount}
        averageTicket={summary.averageTicket}
        tablesServedCount={summary.tablesServedCount}
        observations={closingObservations}
        onObservationsChange={setClosingObservations}
        onConfirm={handleConfirmClosing}
      />
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof Banknote; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-ds2-sm bg-ds2-primary/10">
            <Icon className="h-4 w-4 text-ds2-primary" aria-hidden />
          </div>
          <span className="text-sm font-medium text-ds2-foreground-muted">{label}</span>
        </div>
        <span className="font-numeric text-2xl font-bold tabular-nums tracking-tight text-ds2-foreground">{value}</span>
      </CardContent>
    </Card>
  );
}

interface CaixaClosingModalProps {
  open: boolean;
  onClose: () => void;
  revenue: number;
  closedSessionsCount: number;
  averageTicket: number;
  tablesServedCount: number;
  observations: string;
  onObservationsChange: (value: string) => void;
  onConfirm: () => void;
}

/**
 * Modal de confirmação de Fechamento de Caixa (Sprint "Painel de Caixa" —
 * etapa 1, fluxo visual). Mostra só os 4 números que já vêm de
 * `getCashierData` (mesmo `summary` dos cards de resumo, já filtrado pelo
 * período/busca em uso) — nenhum dado inventado ou mockado.
 *
 * "Resumo por forma de pagamento" fica de fora desta etapa de propósito:
 * `CashierSummary` (`lib/cashier/queries.ts`) ainda não tem esse
 * agregado, e mostrar valores fixos/zerados aqui seria dado falso numa
 * tela financeira — entra numa etapa futura, quando o backend passar a
 * fornecer o agregado real.
 *
 * Sem persistência: "Fechar Caixa" aqui só fecha o modal e dispara um
 * toast informativo. Gravar o fechamento (e o texto de `observations`)
 * fica para a próxima etapa.
 */
function CaixaClosingModal({
  open,
  onClose,
  revenue,
  closedSessionsCount,
  averageTicket,
  tablesServedCount,
  observations,
  onObservationsChange,
  onConfirm,
}: CaixaClosingModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Fechar Caixa"
      description="Confira os dados do período antes de confirmar."
      className="max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirm}>
            Fechar Caixa
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <div className="grid grid-cols-2 gap-4">
          <SummaryCard icon={Banknote} label="Faturamento do período" value={formatCurrency(revenue)} />
          <SummaryCard icon={Receipt} label="Comandas fechadas" value={String(closedSessionsCount)} />
          <SummaryCard icon={ClipboardList} label="Ticket médio" value={formatCurrency(averageTicket)} />
          <SummaryCard icon={LayoutGrid} label="Mesas atendidas" value={String(tablesServedCount)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="closing-observations" className="text-sm font-medium text-ds2-foreground">
            Observações <span className="font-normal text-ds2-foreground-muted">(opcional)</span>
          </label>
          <Textarea
            id="closing-observations"
            value={observations}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onObservationsChange(e.target.value)}
            placeholder="Ex.: retirada de R$ 50 às 14h, estorno da mesa 3..."
          />
          <p className="text-xs text-ds2-foreground-muted">
            Registre aqui qualquer ocorrência importante deste caixa, como retiradas, diferenças, estornos ou outras
            informações relevantes.
          </p>
        </div>
      </div>
    </Modal>
  );
}
