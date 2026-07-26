"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Clock3,
  LayoutGrid,
  Pencil,
  Plus,
  QrCode,
  Receipt,
  Search,
  TrendingUp,
  Trash2,
  UtensilsCrossed,
  Armchair,
  Wallet,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatCurrency, formatRelativeTimeShort } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { restaurantOrdersChannel, restaurantTablesChannel } from "@/lib/realtime/channels";
import { getAppOrigin } from "@/lib/cliente-url";
import { TableQrModal } from "@/components/mesas/table-qr-modal";
import { TableDrawer } from "@/components/mesas/table-drawer";
import {
  deriveTableCardState,
  TABLE_CARD_TONE_CLASSES,
  TABLE_CARD_FILLED_TONES,
  TABLE_CARD_TONE_DOT_CLASSES,
  type TableCardTone,
} from "@/lib/mesas/derive-table-card-state";
import { createTableSchema, updateTableSchema, TABLE_STATUS_VALUES } from "@/lib/validations/tables";
import type { OrderListRow } from "@/components/pedidos/orders-list";
import type { Table as TableEntity, TableStatus } from "@/types/domain";
import type { ApiError, ApiSuccess } from "@/types/api";

// DEBUG TEMPORÁRIO — pedido explícito do dono, para investigar visualmente
// (direto pelo celular, sem precisar de console de navegador) de onde vem
// o host errado no QR Code. Aparece se o build não for de produção OU se
// esta constante estiver `true` — hoje está `true` de propósito, para
// aparecer mesmo no deploy de produção que está sendo investigado agora.
// Remover esta constante e o bloco `{showQrDebugBox && (...)}` mais abaixo
// assim que o problema for identificado.
const DEBUG = true;

interface TablesManagerProps {
  initialTables: TableEntity[];
  /** Slug do restaurante, para montar a URL codificada no QR Code (`/{slug}/mesa/{qr_token}`). */
  restaurantSlug: string;
  /** Para o canal Realtime de pedidos (`restaurant:{id}:orders`). */
  restaurantId: string;
}

interface TableDto {
  id: string;
  name: string;
  status: TableStatus;
  qr_token: string;
}

function fromDto(dto: TableDto): TableEntity {
  return { id: dto.id, name: dto.name, status: dto.status, qrToken: dto.qr_token };
}

const STATUS_LABELS: Record<TableStatus, string> = {
  livre: "Livre",
  ocupada: "Ocupada",
  manutencao: "Manutenção",
};

interface TableOperations {
  totalAmount: number;
  itemCount: number;
  lastOrderAt: string | null;
  hasPendingOrder: boolean;
  orders: OrderListRow[];
}

function aggregateByTable(orders: OrderListRow[]): Record<string, TableOperations> {
  const map: Record<string, TableOperations> = {};

  for (const order of orders) {
    const tableId = order.table.id;
    if (!map[tableId]) {
      map[tableId] = { totalAmount: 0, itemCount: 0, lastOrderAt: null, hasPendingOrder: false, orders: [] };
    }
    const entry = map[tableId];
    entry.totalAmount += order.total_amount;
    entry.itemCount += order.item_count;
    entry.orders.push(order);
    if (!entry.lastOrderAt || order.created_at > entry.lastOrderAt) entry.lastOrderAt = order.created_at;
    if (order.status === "pending") entry.hasPendingOrder = true;
  }

  return map;
}

/**
 * Painel de Mesas (contrato seção 7) — Centro de Operações (pedido do
 * dono, pós-feedback "não quero uma tabela comum"). CRUD de mesas continua
 * aqui (mesmo padrão de sempre, via `/api/v1/tables`); o que mudou é que o
 * tile de cada mesa agora também mostra dado real de operação (valor em
 * aberto, itens, tempo desde o último pedido), agregado a partir de
 * `GET /api/v1/orders` — mesmo endpoint que já alimenta a tela de Pedidos,
 * sem endpoint novo.
 *
 * "Quantidade de pessoas" (pedido no prompt) não aparece em lugar nenhum:
 * não existe esse campo em `Table` nem em `Order` — mostrar um número aqui
 * seria inventado. Fica de fora até existir de verdade.
 *
 * Realtime: mesmo canal `restaurant:{id}:orders` que a tela de Pedidos já
 * usa (`restaurantOrdersChannel`) — qualquer pedido criado/atualizado
 * refaz a agregação. Microinteração de mudança de status: quando o tom
 * derivado de uma mesa muda (ex.: livre → novo pedido, novo pedido →
 * atendimento normal), o tile dispara um único flash curto (leve aumento
 * de escala + reforço de sombra, ~260ms) e volta ao repouso — nunca uma
 * pulsação contínua. O diff é feito comparando o tom atual com o tom do
 * render anterior por mesa (`prevTonesRef`), então só acontece na transição
 * em si, não enquanto o estado "novo pedido" permanece verdadeiro.
 */
export function TablesManager({ initialTables, restaurantSlug, restaurantId }: TablesManagerProps) {
  const [tables, setTables] = useState<TableEntity[]>(initialTables);
  const [operations, setOperations] = useState<Record<string, TableOperations>>({});
  const [operationsError, setOperationsError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableEntity | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<TableStatus>("livre");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deletingTable, setDeletingTable] = useState<TableEntity | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [qrTable, setQrTable] = useState<TableEntity | null>(null);
  const [drawerTable, setDrawerTable] = useState<TableEntity | null>(null);

  // Sprint 2 de Correção: id da mesa que está sendo aberta agora (PATCH em
  // andamento) — evita um duplo clique disparar duas requisições.
  const [openingTableId, setOpeningTableId] = useState<string | null>(null);

  // Estado puramente visual (busca + filtro de status na grade). Não é
  // consumido por nenhuma API/hook — só decide o que é renderizado.
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todas" | TableStatus>("todas");

  // Tick só para forçar recálculo do "há X min" nos tiles a cada 30s —
  // sem isso, o texto ficaria parado até o próximo evento Realtime.
  const [, setClockTick] = useState(0);

  const origin = getAppOrigin();
  const showQrDebugBox = DEBUG || process.env.NODE_ENV !== "production";

  const fetchOperations = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/orders?status=pending,preparing,ready&per_page=100");
      const body = await response.json();
      if (!response.ok) {
        setOperationsError(body?.error?.message ?? "Não foi possível carregar os pedidos em aberto.");
        return;
      }
      const success = body as ApiSuccess<OrderListRow[]>;
      setOperations(aggregateByTable(success.data));
      setOperationsError(null);
    } catch {
      setOperationsError("Não foi possível conectar para carregar os pedidos em aberto.");
    }
  }, []);

  useEffect(() => {
    void fetchOperations();
  }, [fetchOperations]);

  useEffect(() => {
    const interval = setInterval(() => setClockTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Tom derivado de cada mesa neste render — usado só para detectar
  // transição (ver useEffect abaixo). Não substitui `deriveTableCardState`
  // dentro do JSX, que segue sendo a fonte de verdade por card.
  const currentTones = useMemo(() => {
    const map: Record<string, TableCardTone> = {};
    for (const table of tables) {
      map[table.id] = deriveTableCardState(table.status, operations[table.id] ?? null, []).tone;
    }
    return map;
  }, [tables, operations]);

  const prevTonesRef = useRef<Record<string, TableCardTone>>({});
  const [flashingIds, setFlashingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const previous = prevTonesRef.current;
    const changedIds = Object.entries(currentTones)
      .filter(([id, tone]) => previous[id] !== undefined && previous[id] !== tone)
      .map(([id]) => id);

    prevTonesRef.current = currentTones;

    if (changedIds.length === 0) return;

    setFlashingIds((prev) => new Set([...prev, ...changedIds]));
    const timer = setTimeout(() => {
      setFlashingIds((prev) => {
        const next = new Set(prev);
        changedIds.forEach((id) => next.delete(id));
        return next;
      });
    }, 280);

    return () => clearTimeout(timer);
  }, [currentTones]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(restaurantOrdersChannel(restaurantId))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          void fetchOperations();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [restaurantId, fetchOperations]);

  // Sprint 2 de Correção (Fase de Estabilização): sincroniza mudanças de
  // status de mesa entre dispositivos — abrir/liberar/editar numa mesa
  // (deste painel, do Drawer, ou pelo próprio pedido de um cliente via QR
  // Code) agora aparece em qualquer outro painel de Mesas aberto, sem
  // precisar recarregar a página. Atualiza tanto a grade (`tables`) quanto o
  // Drawer aberto no momento, se for a mesma mesa — senão o cabeçalho do
  // Drawer ficaria com o status antigo enquanto a grade já mostraria o novo.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(restaurantTablesChannel(restaurantId))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tables", filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id?: string }).id;
            if (!deletedId) return;
            setTables((prev) => prev.filter((t) => t.id !== deletedId));
            setDrawerTable((prev) => (prev?.id === deletedId ? null : prev));
            return;
          }

          const updated = fromDto(payload.new as TableDto);
          setTables((prev) => {
            const exists = prev.some((t) => t.id === updated.id);
            if (!exists) return [...prev, updated].sort((a, b) => a.name.localeCompare(b.name));
            return prev.map((t) => (t.id === updated.id ? updated : t));
          });
          setDrawerTable((prev) => (prev?.id === updated.id ? updated : prev));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  function tableUrl(table: TableEntity) {
    return `${origin}/${restaurantSlug}/mesa/${table.qrToken}`;
  }

  /**
   * Sprint 2 de Correção — bug da auditoria: "Abrir mesa" só abria o
   * Drawer, sem executar a ação que o rótulo promete. Agora, para uma mesa
   * `livre`, marca de fato `status: "ocupada"` (`PATCH /api/v1/tables/{id}`,
   * mesmo endpoint já usado pelo modal de edição) antes de abrir o Drawer —
   * a atualização local (`setTables`) reflete na grade imediatamente, e a
   * assinatura Realtime acima propaga para qualquer outro painel aberto.
   * Para uma mesa que já não está livre, mantém o comportamento de sempre
   * (só abre o Drawer para consulta/gestão).
   */
  async function handleOpenTable(table: TableEntity) {
    if (table.status !== "livre") {
      setDrawerTable(table);
      return;
    }

    setOpeningTableId(table.id);
    try {
      const response = await fetch(`/api/v1/tables/${table.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ocupada" }),
      });
      const body = await response.json();

      if (!response.ok) {
        const apiError = body as ApiError;
        toast.error("Não foi possível abrir a mesa", apiError?.error?.message ?? "Tente novamente.");
        return;
      }

      const opened = fromDto(body.data as TableDto);
      setTables((prev) => prev.map((t) => (t.id === opened.id ? opened : t)));
      setDrawerTable(opened);
    } catch {
      toast.error("Não foi possível conectar", "Verifique sua internet e tente novamente.");
    } finally {
      setOpeningTableId(null);
    }
  }

  function openCreateModal() {
    setEditingTable(null);
    setName("");
    setStatus("livre");
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(table: TableEntity) {
    setEditingTable(table);
    setName(table.name);
    setStatus(table.status);
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const isEditing = Boolean(editingTable);

    if (isEditing) {
      const result = updateTableSchema.safeParse({ name, status });
      if (!result.success) {
        setFormError(result.error.issues[0]?.message ?? "Dados inválidos.");
        return;
      }

      setIsSubmitting(true);
      try {
        const response = await fetch(`/api/v1/tables/${editingTable!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const body = await response.json();

        if (!response.ok) {
          const apiError = body as ApiError;
          setFormError(apiError.error?.message ?? "Não foi possível salvar a mesa.");
          setIsSubmitting(false);
          return;
        }

        const saved = fromDto(body.data as TableDto);
        setTables((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
        toast.success("Mesa atualizada");
        setModalOpen(false);
        setIsSubmitting(false);
      } catch {
        setFormError("Não foi possível conectar. Verifique sua internet e tente novamente.");
        setIsSubmitting(false);
      }
      return;
    }

    // Criação: nome em branco é válido (contrato 7.2 — gera automaticamente).
    const result = createTableSchema.safeParse({ name: name.trim() ? name : undefined });
    if (!result.success) {
      setFormError(result.error.issues[0]?.message ?? "Nome inválido.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/v1/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      const body = await response.json();

      if (!response.ok) {
        const apiError = body as ApiError;
        setFormError(apiError.error?.message ?? "Não foi possível criar a mesa.");
        setIsSubmitting(false);
        return;
      }

      const saved = fromDto(body.data as TableDto);
      setTables((prev) => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success("Mesa criada");
      setModalOpen(false);
      setIsSubmitting(false);
    } catch {
      setFormError("Não foi possível conectar. Verifique sua internet e tente novamente.");
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deletingTable) return;
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/v1/tables/${deletingTable.id}`, { method: "DELETE" });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiError | null;
        toast.error("Não foi possível excluir", body?.error?.message ?? "Tente novamente em instantes.");
        setIsDeleting(false);
        return;
      }

      setTables((prev) => prev.filter((t) => t.id !== deletingTable.id));
      toast.success("Mesa excluída");
      setDeletingTable(null);
      setIsDeleting(false);
    } catch {
      toast.error("Não foi possível conectar", "Verifique sua internet e tente novamente.");
      setIsDeleting(false);
    }
  }

  const drawerOperations = drawerTable ? operations[drawerTable.id] : undefined;

  // Agregados derivados do que já está carregado (tables + operations) —
  // nenhum dado novo, só leitura do que o componente já tem em mãos.
  const totalTables = tables.length;
  const freeCount = tables.filter((t) => t.status === "livre").length;
  const occupiedCount = tables.filter((t) => t.status === "ocupada").length;
  const maintenanceCount = tables.filter((t) => t.status === "manutencao").length;
  const openOrdersList = Object.values(operations).flatMap((op) => op.orders);
  const activeOrdersCount = openOrdersList.length;
  const openAmount = Object.values(operations).reduce((sum, op) => sum + op.totalAmount, 0);
  const averageTicket = activeOrdersCount > 0 ? openAmount / activeOrdersCount : null;

  const indicators: Array<{
    key: string;
    label: string;
    value: string;
    icon: LucideIcon;
    tone: "success" | "warning" | "muted" | "info" | "default";
  }> = [
    { key: "livres", label: "Mesas livres", value: String(freeCount), icon: Armchair, tone: "success" },
    { key: "ocupadas", label: "Mesas ocupadas", value: String(occupiedCount), icon: UtensilsCrossed, tone: "warning" },
    { key: "manutencao", label: "Em manutenção", value: String(maintenanceCount), icon: Wrench, tone: "muted" },
    { key: "pedidos", label: "Pedidos em aberto", value: String(activeOrdersCount), icon: Receipt, tone: "info" },
    { key: "valor", label: "Valor em aberto", value: formatCurrency(openAmount), icon: Wallet, tone: "default" },
    {
      key: "ticket",
      label: "Ticket médio",
      value: averageTicket !== null ? formatCurrency(averageTicket) : "—",
      icon: TrendingUp,
      tone: "default",
    },
  ];

  const toneClasses: Record<(typeof indicators)[number]["tone"], string> = {
    success: "bg-success/10 text-success ring-1 ring-inset ring-success/15",
    warning: "bg-warning/10 text-warning ring-1 ring-inset ring-warning/15",
    muted: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
    info: "bg-info/10 text-info ring-1 ring-inset ring-info/15",
    default: "bg-primary/10 text-primary ring-1 ring-inset ring-primary/15",
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredTables = tables.filter((table) => {
    const matchesStatus = statusFilter === "todas" || table.status === statusFilter;
    const matchesQuery = normalizedQuery.length === 0 || table.name.toLowerCase().includes(normalizedQuery);
    return matchesStatus && matchesQuery;
  });

  const STATUS_FILTER_OPTIONS: Array<{ value: "todas" | TableStatus; label: string }> = [
    { value: "todas", label: "Todas" },
    { value: "livre", label: "Livres" },
    { value: "ocupada", label: "Ocupadas" },
    { value: "manutencao", label: "Manutenção" },
  ];

  return (
    <div className="flex flex-col gap-5">
      {showQrDebugBox && (
        <div className="flex flex-col gap-1.5 rounded-xl border-2 border-dashed border-destructive bg-destructive/5 p-3 font-mono text-[11px] leading-relaxed text-foreground">
          <p className="font-sans text-xs font-bold uppercase tracking-wide text-destructive">
            🐞 Debug temporário — origem da URL do QR Code
          </p>
          <p className="break-all">
            <span className="text-muted-foreground">NEXT_PUBLIC_APP_URL:</span>{" "}
            {process.env.NEXT_PUBLIC_APP_URL ?? "(não definida)"}
          </p>
          <p className="break-all">
            <span className="text-muted-foreground">getAppOrigin():</span> {origin || "(vazio)"}
          </p>
          <p className="break-all">
            <span className="text-muted-foreground">tableUrl() [1ª mesa da lista]:</span>{" "}
            {tables[0] ? tableUrl(tables[0]) : "(nenhuma mesa cadastrada)"}
          </p>
          <p className="break-all">
            <span className="text-muted-foreground">URL final enviada ao TableQrModal:</span>{" "}
            {qrTable ? tableUrl(qrTable) : "(nenhum modal de QR Code aberto agora — toque em \"Ver QR Code\" de uma mesa)"}
          </p>
        </div>
      )}

      {operationsError && (
        <Alert variant="warning">
          {operationsError} — os tiles mostram só o status da mesa, sem dado de pedido em aberto.
        </Alert>
      )}

      {/* Header Operacional */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LayoutGrid className="h-5 w-5" aria-hidden />
          </span>
          <div className="flex flex-col">
            <h2 className="font-display text-xl font-semibold leading-tight">Centro de Operações</h2>
            <p className="text-sm text-muted-foreground">
              {totalTables === 0
                ? "Nenhuma mesa cadastrada"
                : `${totalTables} ${totalTables === 1 ? "mesa cadastrada" : "mesas cadastradas"}`}
            </p>
          </div>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          Nova mesa
        </Button>
      </div>

      {/* Indicadores */}
      {totalTables > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {indicators.map((indicator) => (
            <div
              key={indicator.key}
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3.5 shadow-card"
            >
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", toneClasses[indicator.tone])}>
                <indicator.icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="font-numeric text-xl font-bold tabular-nums text-foreground">{indicator.value}</span>
              <span className="text-xs text-muted-foreground">{indicator.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Barra de filtros */}
      {totalTables > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar mesa por nome..."
            leadingIcon={<Search />}
            className="sm:max-w-xs"
            aria-label="Buscar mesa"
          />
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTER_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={statusFilter === option.value ? "secondary" : "ghost"}
                onClick={() => setStatusFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Grade de Mesas */}
      {tables.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="Nenhuma mesa cadastrada"
          description="Adicione a primeira mesa para gerar seu QR Code de acesso ao cardápio."
          action={
            <Button onClick={openCreateModal} variant="outline">
              <Plus className="h-4 w-4" />
              Nova mesa
            </Button>
          }
        />
      ) : filteredTables.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhuma mesa encontrada"
          description="Ajuste a busca ou o filtro de status para ver outras mesas."
          action={
            <Button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("todas");
              }}
              variant="outline"
            >
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filteredTables.map((table) => {
            const data = operations[table.id] ?? null;
            const state = deriveTableCardState(table.status, data, []);
            const isFilled = TABLE_CARD_FILLED_TONES.includes(state.tone);
            const isFlashing = flashingIds.has(table.id);

            const dotClass = isFilled ? "bg-white/70" : TABLE_CARD_TONE_DOT_CLASSES[state.tone];
            const ordersCount = data?.orders.length ?? 0;
            const actionLabel = table.status === "livre" ? "Abrir mesa" : "Ver mesa";

            return (
              <div
                key={table.id}
                className={cn(
                  "group relative flex h-full flex-col gap-2 overflow-hidden rounded-2xl border p-2.5 shadow-card transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-card-hover",
                  TABLE_CARD_TONE_CLASSES[state.tone],
                  isFlashing && "animate-status-flash",
                )}
              >
                {/* Ícone decorativo — só personalidade visual, sem função. */}
                <Armchair
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute -bottom-2 -right-2 h-11 w-11",
                    isFilled ? "text-white/15" : "text-muted-foreground/10",
                  )}
                />

                <div className="absolute right-1 top-1 z-20 flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQrTable(table);
                    }}
                    aria-label={`Ver QR Code de ${table.name}`}
                    className={cn(
                      "h-8 w-8 opacity-70 hover:opacity-100",
                      isFilled ? "text-white hover:bg-white/15 hover:text-white" : "text-muted-foreground",
                    )}
                  >
                    <QrCode className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(table);
                    }}
                    aria-label={`Editar ${table.name}`}
                    className={cn(
                      "h-8 w-8 opacity-70 hover:opacity-100",
                      isFilled ? "text-white hover:bg-white/15 hover:text-white" : "text-muted-foreground",
                    )}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingTable(table);
                    }}
                    aria-label={`Excluir ${table.name}`}
                    className={cn(
                      "h-8 w-8 opacity-70 hover:opacity-100",
                      isFilled ? "text-white hover:bg-white/15 hover:text-white" : "text-destructive",
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* 1. Número da mesa — maior elemento do card, sem dominá-lo. */}
                <span
                  className={cn(
                    "z-10 pr-14 font-numeric text-2xl font-bold leading-none tabular-nums",
                    isFilled ? "text-white" : "text-foreground",
                  )}
                >
                  {table.name}
                </span>

                {/* 2. Status — badge elegante com indicador de cor, nunca texto solto. */}
                <span
                  className={cn(
                    "z-10 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    isFilled ? "bg-white/20 text-white" : "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
                  )}
                >
                  <span className={cn("h-1 w-1 shrink-0 rounded-full", dotClass)} aria-hidden />
                  {state.label}
                </span>

                {/* 3 + 4. Valor em aberto (se existir) e tempo, discreto. */}
                {data ? (
                  <div className="z-10 flex flex-col gap-0.5">
                    <span
                      className={cn(
                        "font-numeric text-lg font-bold leading-tight tabular-nums",
                        isFilled ? "text-white" : "text-foreground",
                      )}
                    >
                      {formatCurrency(data.totalAmount)}
                    </span>
                    {data.lastOrderAt && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-[10px]",
                          isFilled ? "text-white/70" : "text-muted-foreground",
                        )}
                      >
                        <Clock3 className="h-2.5 w-2.5 shrink-0" aria-hidden />
                        último pedido {formatRelativeTimeShort(data.lastOrderAt)}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className={cn("z-10 text-[11px]", isFilled ? "text-white/70" : "text-muted-foreground")}>
                    Sem pedidos em aberto
                  </span>
                )}

                {/* 5. Resumo operacional — só o que já existe (itens, pedidos). */}
                {data && (data.itemCount > 0 || ordersCount > 0) && (
                  <div
                    className={cn(
                      "z-10 flex items-center gap-2.5 text-[10px]",
                      isFilled ? "text-white/80" : "text-muted-foreground",
                    )}
                  >
                    {ordersCount > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Receipt className="h-2.5 w-2.5 shrink-0" aria-hidden />
                        {ordersCount} {ordersCount === 1 ? "pedido" : "pedidos"}
                      </span>
                    )}
                    {data.itemCount > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <UtensilsCrossed className="h-2.5 w-2.5 shrink-0" aria-hidden />
                        {data.itemCount} {data.itemCount === 1 ? "item" : "itens"}
                      </span>
                    )}
                  </div>
                )}

                {/* Ação principal — sempre visível, alvo de toque grande, fixada no final do card. */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  isLoading={openingTableId === table.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleOpenTable(table);
                  }}
                  className={cn(
                    "z-10 mt-auto h-7 w-full justify-center border text-xs font-semibold",
                    isFilled
                      ? "border-white/25 bg-white/10 text-white hover:bg-white/20"
                      : "border-border bg-surface hover:bg-muted",
                  )}
                >
                  {actionLabel}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTable ? "Editar mesa" : "Nova mesa"}
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 pb-6">
          <FormField
            label="Nome da mesa"
            error={formError ?? undefined}
            hint={editingTable ? undefined : "Deixe em branco para gerar o próximo número automaticamente."}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Mesa 01, Varanda 2"
              disabled={isSubmitting}
              autoFocus
            />
          </FormField>

          {editingTable && (
            <FormField label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value as TableStatus)}>
                {TABLE_STATUS_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingTable ? "Salvar" : "Criar mesa"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingTable)}
        onOpenChange={(open) => !open && setDeletingTable(null)}
        title="Excluir mesa"
        description={`Tem certeza que deseja excluir "${deletingTable?.name}"? Mesas com uma comanda em aberto não podem ser excluídas.`}
        variant="destructive"
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        isConfirming={isDeleting}
      />

      {qrTable && (
        <TableQrModal
          open={Boolean(qrTable)}
          onClose={() => setQrTable(null)}
          tableName={qrTable.name}
          url={tableUrl(qrTable)}
        />
      )}

      {drawerTable && (
        <TableDrawer
          table={drawerTable}
          openOrders={drawerOperations?.orders ?? []}
          onClose={() => setDrawerTable(null)}
          onOrdersChanged={() => void fetchOperations()}
          onTableUpdated={(updated) => {
            setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            setDrawerTable(updated);
          }}
        />
      )}
    </div>
  );
}
