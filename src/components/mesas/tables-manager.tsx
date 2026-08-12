"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  Bell,
  Clock3,
  Hand,
  LayoutGrid,
  Pencil,
  Plus,
  QrCode,
  Receipt,
  Search,
  TrendingUp,
  Trash2,
  UtensilsCrossed,
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
import { restaurantOrdersChannel, restaurantTablesChannel, restaurantTableEventsChannel } from "@/lib/realtime/channels";
import { useRealtimeConnectionStatus } from "@/lib/realtime/use-realtime-connection-status";
import { RealtimeStatusIndicator } from "@/components/realtime/realtime-status-indicator";
import { getAppOrigin } from "@/lib/cliente-url";
import { TableQrModal } from "@/components/mesas/table-qr-modal";
import { TableDrawer } from "@/components/mesas/table-drawer";
import {
  deriveTableCardState,
  TABLE_CARD_TONE_CLASSES,
  TABLE_CARD_FILLED_TONES,
  TABLE_CARD_TONE_DOT_CLASSES,
  TABLE_CARD_TONE_DARK_TEXT,
  type TableCardTone,
  type TableCardAlert,
} from "@/lib/mesas/derive-table-card-state";
import { playNewOrderChime } from "@/lib/mesas/play-new-order-chime";
import { createTableSchema, updateTableSchema, TABLE_STATUS_VALUES, PAYMENT_METHOD_VALUES } from "@/lib/validations/tables";
import type { OrderListRow } from "@/components/pedidos/orders-list";
import type { Table as TableEntity, TableStatus, TableEvent } from "@/types/domain";
import type { ApiError, ApiSuccess } from "@/types/api";

interface TablesManagerProps {
  initialTables: TableEntity[];
  /** Slug do restaurante, para montar a URL codificada no QR Code (`/{slug}/mesa/{qr_token}`). */
  restaurantSlug: string;
  /** Para o canal Realtime de pedidos (`restaurant:{id}:orders`). */
  restaurantId: string;
  /** Fase 4B.1 (2026-08-10) — já normalizado por `resolveAcceptedPaymentMethods` em `mesas/page.tsx`; só passagem até `<CloseBillModal>`. */
  acceptedPaymentMethods: (typeof PAYMENT_METHOD_VALUES)[number][];
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
  /** Item 1 do checklist do fluxo operacional — ver `TableOperationalData` em `derive-table-card-state.ts`. */
  hasPreparingOrder: boolean;
  orders: OrderListRow[];
}

function aggregateByTable(orders: OrderListRow[]): Record<string, TableOperations> {
  const map: Record<string, TableOperations> = {};

  for (const order of orders) {
    const tableId = order.table.id;
    if (!map[tableId]) {
      map[tableId] = {
        totalAmount: 0,
        itemCount: 0,
        lastOrderAt: null,
        hasPendingOrder: false,
        hasPreparingOrder: false,
        orders: [],
      };
    }
    const entry = map[tableId];
    entry.totalAmount += order.total_amount;
    entry.itemCount += order.item_count;
    entry.orders.push(order);
    if (!entry.lastOrderAt || order.created_at > entry.lastOrderAt) entry.lastOrderAt = order.created_at;
    if (order.status === "pending") entry.hasPendingOrder = true;
    if (order.status === "preparing") entry.hasPreparingOrder = true;
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
 * de escala + sombra reforçada + ring/brilho temporário na cor da marca,
 * ~700ms) e volta ao repouso — nunca uma
 * pulsação contínua. O diff é feito comparando o tom atual com o tom do
 * render anterior por mesa (`prevTonesRef`), então só acontece na transição
 * em si, não enquanto o estado "novo pedido" permanece verdadeiro.
 */
export function TablesManager({ initialTables, restaurantSlug, restaurantId, acceptedPaymentMethods }: TablesManagerProps) {
  const [tables, setTables] = useState<TableEntity[]>(initialTables);
  const [operations, setOperations] = useState<Record<string, TableOperations>>({});
  const [operationsError, setOperationsError] = useState<string | null>(null);
  // "Chamar garçom" / "Solicitar conta" (docs/table-events-roadmap.md) —
  // eventos em aberto, agregados por mesa. Mesmo padrão de `operations`:
  // um Record por table.id, alimentado por `fetchTableEvents()`.
  const [tableEvents, setTableEvents] = useState<Record<string, TableCardAlert[]>>({});

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

  // Estado puramente visual (busca + filtro de status na grade). Não é
  // consumido por nenhuma API/hook — só decide o que é renderizado.
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todas" | TableStatus>("todas");

  // Tick só para forçar recálculo do "há X min" nos tiles a cada 30s —
  // sem isso, o texto ficaria parado até o próximo evento Realtime.
  const [, setClockTick] = useState(0);

  const origin = getAppOrigin();

  const fetchOperations = useCallback(async () => {
    try {
      // Sprint "Fonte Única de Verdade — order_session" (2026-07-30,
      // seguinte à Correção "Pedido Finalizado Sumindo da Mesa"): a
      // correção anterior (incluir `delivered` na lista de status) trocou
      // um bug por outro — `delivered` é permanente, então um pedido de
      // uma sessão já FECHADA (mesa já liberada, talvez há dias) nunca
      // parava de aparecer aqui, porque a query só olhava `status`, nunca
      // "essa sessão ainda está aberta?". Resultado: mesa "Livre"
      // mostrando valor/itens de comanda antiga, e nada em "Liberar mesa"
      // conseguia resolver, porque não havia de fato nada pendente.
      //
      // `GET /api/v1/tables/operations` substitui a lista de status por
      // completo — ele devolve só pedidos de `order_sessions` com
      // `closed_at is null` (mesmo critério de `close_table_bill`, ver
      // `lib/tables/get-open-table-operations.ts`). Nenhuma lista de
      // status a manter aqui nunca mais: um pedido para de contar no
      // instante em que a sessão dele fecha, não importa o status.
      const response = await fetch("/api/v1/tables/operations");
      const body = await response.json();
      if (!response.ok) {
        setOperationsError(body?.error?.message ?? "Não foi possível carregar os pedidos em aberto.");
        return;
      }
      const success = body as ApiSuccess<OrderListRow[]>;
      const aggregated = aggregateByTable(success.data);
      setOperations(aggregated);
      setOperationsError(null);
    } catch {
      setOperationsError("Não foi possível conectar para carregar os pedidos em aberto.");
    }
  }, []);

  // Correção Sprint 2 (Painel Vivo): causa raiz do "só atualiza com F5":
  // o Supabase Realtime NÃO reenvia eventos perdidos enquanto o canal
  // estava desconectado (aba em segundo plano, blip de rede, renovação de
  // token — tudo isso derruba o WebSocket por alguns instantes, rotineiramente,
  // sem nenhum aviso visível). Um pedido criado/alterado exatamente nesse
  // intervalo nunca chega — só um F5 (que refaz a busca do zero) corrige.
  // `fetchTables` espelha `fetchOperations`, mas para a lista de mesas
  // (`GET /api/v1/tables`, mesmo endpoint que já alimenta o CRUD deste
  // painel — nenhum contrato novo). Ambas são chamadas sempre que um canal
  // (re)conecta (`subscriptionStatus === "SUBSCRIBED"`, nos dois efeitos
  // logo abaixo) — não só na primeira carga — para fechar exatamente essa
  // lacuna, sem depender de polling nem de o usuário recarregar a página.
  const fetchTables = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/tables");
      const body = await response.json();
      if (!response.ok) return;
      const success = body as ApiSuccess<TableDto[]>;
      const freshTables = success.data.map(fromDto).sort((a, b) => a.name.localeCompare(b.name));
      setTables(freshTables);
      setDrawerTable((prev) => (prev ? (freshTables.find((t) => t.id === prev.id) ?? prev) : prev));
    } catch {
      // Resync best-effort: se esta busca falhar, a próxima reconexão do
      // canal tenta de novo — não há necessidade de expor erro para isso,
      // a grade continua mostrando o último estado válido conhecido.
    }
  }, []);

  // "Chamar garçom" / "Solicitar conta" (docs/table-events-roadmap.md) —
  // mesmo padrão exato de `fetchOperations`: uma única busca para todo o
  // restaurante (`GET /api/v1/tables/events?status=open`), agregada por
  // mesa no cliente. Chamada no mount e a cada (re)conexão do canal de
  // eventos (efeito logo abaixo), pelo mesmo motivo já documentado acima.
  const fetchTableEvents = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/tables/events?status=open");
      if (!response.ok) {
        return;
      }
      const body = (await response.json()) as ApiSuccess<TableEvent[]>;

      const map: Record<string, TableCardAlert[]> = {};
      for (const event of body.data) {
        const tableId = event.table.id;
        if (!map[tableId]) map[tableId] = [];
        map[tableId].push({ id: event.id, type: event.type, createdAt: event.createdAt });
      }

      setTableEvents(map);
    } catch {
      // Mesmo raciocínio best-effort de `fetchTables`/`fetchOperations`: a
      // próxima reconexão do canal tenta de novo.
    }
  }, []);

  useEffect(() => {
    void fetchOperations();
  }, [fetchOperations]);

  useEffect(() => {
    void fetchTableEvents();
  }, [fetchTableEvents]);

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
      map[table.id] = deriveTableCardState(
        table.status,
        operations[table.id] ?? null,
        tableEvents[table.id] ?? [],
      ).tone;
    }
    return map;
  }, [tables, operations, tableEvents]);

  // Sprint 2 (Painel Vivo): status agregado dos dois canais assinados logo
  // abaixo (`orders` e `tables`) — nenhum canal novo, só observação do que
  // já existe. Renderizado no header via `<RealtimeStatusIndicator>`.
  const { status: realtimeStatus, reportStatus } = useRealtimeConnectionStatus(["orders", "tables", "table_events"]);

  const prevTonesRef = useRef<Record<string, TableCardTone>>({});
  const [flashingIds, setFlashingIds] = useState<Set<string>>(new Set());
  // Corrige o bug auditado: um único `setTimeout` compartilhado fazia o
  // cleanup de um `useEffect` (disparado por QUALQUER mesa mudando de tom)
  // cancelar a remoção agendada de OUTRA mesa que ainda estava "piscando"
  // dentro da mesma janela de ~700ms. Agora cada mesa tem seu próprio timer,
  // indexado por table.id neste Map — remover/cancelar o de uma nunca afeta
  // o de outra.
  const flashTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Limpa qualquer timer pendente quando o componente desmonta (evita
  // `setFlashingIds` chamado depois de desmontado).
  useEffect(() => {
    return () => {
      for (const timer of flashTimersRef.current.values()) clearTimeout(timer);
      flashTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const previous = prevTonesRef.current;

    const changedIds = Object.entries(currentTones)
      .filter(([id, tone]) => previous[id] !== undefined && previous[id] !== tone)
      .map(([id]) => id);

    prevTonesRef.current = currentTones;

    if (changedIds.length === 0) return;

    setFlashingIds((prev) => new Set([...prev, ...changedIds]));

    // Um timer POR MESA, não um só para o grupo inteiro de `changedIds`
    // deste run. Se essa mesa específica já tinha um timer pendente (ela
    // piscou de novo antes do anterior terminar), cancela só o dela e
    // reinicia a janela — nunca mexe no timer de nenhuma outra mesa.
    for (const id of changedIds) {
      const existingTimer = flashTimersRef.current.get(id);
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(() => {
        setFlashingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        flashTimersRef.current.delete(id);
        // 700ms = mesma duração de "status-flash" em tailwind.config.ts. Se
        // esse número mudar lá, precisa mudar aqui também — senão a classe
        // `animate-status-flash` é removida antes da animação CSS terminar,
        // cortando o efeito no meio em vez de deixá-lo concluir suavemente.
      }, 700);

      flashTimersRef.current.set(id, timer);
    }

    // Sem `return () => clearTimeout(...)` aqui de propósito — é exatamente
    // isso que causava o bug: um cleanup genérico cancelava o timer de
    // qualquer mesa sempre que ESTE efeito rodasse de novo por causa de
    // OUTRA mesa. Cada timer agora é dono de si mesmo, gerenciado só pelo
    // Map acima; o cleanup do efeito de unmount (logo acima) cuida de
    // limpar tudo se o componente sair de tela com timers pendentes.
  }, [currentTones]);

  // Sprint "Destaque de Pedido Não Processado" (2026-07-31), corrigida no
  // mesmo dia a pedido do dono: sinal próprio para o som — deliberadamente
  // SEPARADO de `currentTones`/`prevTonesRef` acima (que existem só para o
  // flash visual). Guarda a QUANTIDADE de pedidos da mesa (`orders.length`,
  // já disponível em `TableOperationalData` — nenhum campo novo) junto com
  // `hasUnprocessedOrders`, em vez de `table.status`: a regra de negócio é
  // "0 pedidos → 1 pedido não toca; N pedidos → N+1 toca (N ≥ 1)" — uma
  // contagem, não um estado de mesa. Desacoplado de propósito: continua
  // funcionando sem nenhuma mudança aqui se um dia existirem novos status
  // de mesa (reservada, bloqueada, aguardando pagamento etc.) — a regra
  // nunca olha `table.status`.
  const currentSoundSignals = useMemo(() => {
    const map: Record<string, { orderCount: number; hasUnprocessedOrders: boolean }> = {};
    for (const table of tables) {
      const data = operations[table.id] ?? null;
      map[table.id] = {
        orderCount: data?.orders.length ?? 0,
        hasUnprocessedOrders: deriveTableCardState(table.status, data, tableEvents[table.id] ?? []).hasUnprocessedOrders,
      };
    }
    return map;
  }, [tables, operations, tableEvents]);

  const prevSoundSignalsRef = useRef<Record<string, { orderCount: number; hasUnprocessedOrders: boolean }>>({});

  useEffect(() => {
    const previous = prevSoundSignalsRef.current;

    // Só considera transição de verdade quando já existia um valor anterior
    // para esta mesa (mesmo guard de `previous[id] !== undefined` usado no
    // efeito do flash acima) — evita disparar som na primeira carga da
    // página só porque uma mesa já chegou com `hasUnprocessedOrders: true`.
    const shouldPlay = Object.entries(currentSoundSignals).some(([id, current]) => {
      const prior = previous[id];
      if (!prior) return false;

      const justBecameUnprocessed = prior.hasUnprocessedOrders === false && current.hasUnprocessedOrders === true;
      if (!justBecameUnprocessed) return false;

      // Regra de negócio: não toca quando é o primeiro pedido da mesa
      // (contagem saindo de 0) — qualquer pedido seguinte (1→2, 2→3, ...)
      // toca. Baseado só na quantidade de pedidos, nunca em `table.status`.
      const wasFirstOrderEver = prior.orderCount === 0;
      return !wasFirstOrderEver;
    });

    prevSoundSignalsRef.current = currentSoundSignals;

    if (shouldPlay) {
      playNewOrderChime();
    }
  }, [currentSoundSignals]);

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
      .subscribe((subscriptionStatus) => {
        reportStatus("orders", subscriptionStatus);
        if (subscriptionStatus === "SUBSCRIBED") {
          void fetchOperations();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [restaurantId, fetchOperations, reportStatus]);

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
      .subscribe((subscriptionStatus) => {
        reportStatus("tables", subscriptionStatus);
        if (subscriptionStatus === "SUBSCRIBED") {
          void fetchTables();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [restaurantId, reportStatus, fetchTables]);

  // "Chamar garçom" / "Solicitar conta" (docs/table-events-roadmap.md) —
  // mesmo padrão exato dos outros dois canais: qualquer INSERT/UPDATE em
  // `table_events` refaz a busca inteira (`fetchTableEvents`), e a busca
  // também roda a cada (re)conexão do canal (`SUBSCRIBED`), fechando a
  // mesma lacuna de eventos perdidos durante uma desconexão já corrigida
  // para `orders`/`tables`.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(restaurantTableEventsChannel(restaurantId))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "table_events", filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          void fetchTableEvents();
        },
      )
      .subscribe((subscriptionStatus) => {
        reportStatus("table_events", subscriptionStatus);
        if (subscriptionStatus === "SUBSCRIBED") {
          void fetchTableEvents();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [restaurantId, reportStatus, fetchTableEvents]);

  function tableUrl(table: TableEntity) {
    return `${origin}/${restaurantSlug}/mesa/${table.qrToken}`;
  }

  /**
   * Sprint "Correção — Abrir Mesa Não Deve Mudar Status" (2026-07-30):
   * antes, esta função marcava `status: "ocupada"` (`PATCH /api/v1/tables/{id}`)
   * sempre que a mesa clicada estivesse `livre`, antes de abrir o Drawer —
   * decisão de uma sprint anterior ("Sprint 2 de Correção"), que o dono
   * decidiu reverter: abrir/visualizar uma mesa nunca deve alterar o estado
   * dela. Agora esta função só abre o Drawer, sempre, sem nenhuma escrita —
   * a mesa só passa a `"ocupada"` quando o primeiro pedido real chega
   * (`createPublicOrder`, `src/lib/orders/create-order.ts`, inalterado), e
   * só volta a `"livre"` ao fechar a conta (`close_table_bill`, também
   * inalterado) ou via "Liberar mesa" (`handleReleaseTable`, também
   * inalterado).
   */
  function handleOpenTable(table: TableEntity) {
    setDrawerTable(table);
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
    success: "bg-ds2-success/10 text-ds2-success ring-1 ring-inset ring-ds2-success/15",
    warning: "bg-ds2-warning/10 text-ds2-warning ring-1 ring-inset ring-ds2-warning/15",
    muted: "bg-ds2-surface-hover text-ds2-foreground-muted ring-1 ring-inset ring-ds2-border",
    info: "bg-ds2-info/10 text-ds2-info ring-1 ring-inset ring-ds2-info/15",
    default: "bg-ds2-primary/10 text-ds2-primary ring-1 ring-inset ring-ds2-primary/15",
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

  // `focusRingClass`: aplicado por instância a elementos que não são
  // `Button` — `Button` já tem `focus-visible` nativo desde a migração DS2
  // do componente; onde este valor ainda é passado para um `<Button>`, é
  // redundante (não incorreto, só duplicado) e pode ser retirado numa
  // limpeza futura desses call sites específicos.
  const focusRingClass =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds2-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ds2-background";

  return (
    <div className="flex flex-col gap-5">
      {operationsError && (
        <Alert variant="warning">
          {operationsError} — os tiles mostram só o status da mesa, sem dado de pedido em aberto.
        </Alert>
      )}

      {/* Header Operacional */}
      <div className="flex flex-col gap-4 rounded-ds2-lg border border-ds2-border bg-ds2-surface p-5 shadow-ds2-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-ds2-md bg-ds2-primary/10 text-ds2-primary">
            <LayoutGrid className="h-5 w-5" aria-hidden />
          </span>
          <div className="flex flex-col">
            <h2 className="font-display text-xl font-semibold leading-tight text-ds2-foreground">Centro de Operações</h2>
            <p className="text-sm text-ds2-foreground-muted">
              {totalTables === 0
                ? "Nenhuma mesa cadastrada"
                : `${totalTables} ${totalTables === 1 ? "mesa cadastrada" : "mesas cadastradas"}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <RealtimeStatusIndicator status={realtimeStatus} />
          <Button onClick={openCreateModal} className={focusRingClass}>
            <Plus className="h-4 w-4" />
            Nova mesa
          </Button>
        </div>
      </div>

      {/* Indicadores */}
      {totalTables > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {indicators.map((indicator) => (
            <div
              key={indicator.key}
              className="flex flex-col gap-2 rounded-ds2-md border border-ds2-border bg-ds2-surface p-3.5 shadow-ds2-sm"
            >
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-ds2-sm", toneClasses[indicator.tone])}>
                <indicator.icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="font-numeric text-xl font-bold tabular-nums text-ds2-foreground">{indicator.value}</span>
              <span className="text-xs text-ds2-foreground-muted">{indicator.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Barra de filtros */}
      {totalTables > 0 && (
        <div className="flex flex-col gap-3 rounded-ds2-md border border-ds2-border bg-ds2-surface p-3 sm:flex-row sm:items-center sm:justify-between">
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
                className={focusRingClass}
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
            <Button onClick={openCreateModal} variant="outline" className={focusRingClass}>
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
              className={focusRingClass}
            >
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filteredTables.map((table) => {
            const data = operations[table.id] ?? null;
            const alerts = tableEvents[table.id] ?? [];
            const state = deriveTableCardState(table.status, data, alerts);
            const isFilled = TABLE_CARD_FILLED_TONES.includes(state.tone);
            // Sprint UI-02 (2026-07-31): ver `TABLE_CARD_TONE_DARK_TEXT` —
            // `new_order` tem fundo claro (`ds2-warning`), então precisa de
            // texto/ícone ESCURO em vez do branco genérico usado pelos
            // outros tons preenchidos.
            const isDarkOnLight = TABLE_CARD_TONE_DARK_TEXT.includes(state.tone);
            const isFlashing = flashingIds.has(table.id);

            const dotClass = isFilled
              ? isDarkOnLight
                ? "bg-ds2-warning-foreground/70"
                : "bg-white/70"
              : TABLE_CARD_TONE_DOT_CLASSES[state.tone];
            const ordersCount = data?.orders.length ?? 0;
            // Sprint "Destaque de Pedido Não Processado" (2026-07-31):
            // contagem só pra exibição do badge ("1 NOVO"/"2 NOVOS") — não
            // é um campo novo em `TableOperationalData`/`deriveTableCardState`,
            // é derivado aqui direto de `data.orders` (que já traz o status
            // de cada pedido), sem mudar nenhuma lib compartilhada.
            const pendingCount = data?.orders.filter((o) => o.status === "pending").length ?? 0;
            // Sprint "Correção — Abrir Mesa Não Deve Mudar Status"
            // (2026-07-30): rótulo único — o clique sempre só abre o
            // Drawer agora, para qualquer status; manter "Abrir mesa" só
            // pra mesas livres passaria a impressão errada de que algo
            // muda ao clicar.
            const actionLabel = "Ver mesa";
            const toneClass = TABLE_CARD_TONE_CLASSES[state.tone];

            return (
              <div
                key={table.id}
                data-table-tile-id={table.id}
                className={cn(
                  "group relative flex h-full flex-col gap-2 overflow-hidden rounded-ds2-lg border p-2.5 shadow-ds2-sm transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-ds2-md",
                  toneClass,
                  isFlashing && "animate-status-flash",
                  state.hasUnprocessedOrders && "animate-new-order-alert",
                )}
              >
                {/* Ícone decorativo — só personalidade visual, sem função. */}
                <Armchair
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute -bottom-2 -right-2 h-11 w-11",
                    isFilled ? (isDarkOnLight ? "text-ds2-warning-foreground/15" : "text-white/15") : "text-ds2-foreground-muted/10",
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
                      isFilled
                        ? isDarkOnLight
                          ? "text-ds2-warning-foreground hover:bg-ds2-warning-foreground/15 hover:text-ds2-warning-foreground"
                          : "text-white hover:bg-white/15 hover:text-white"
                        : "text-ds2-foreground-muted",
                      focusRingClass,
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
                      isFilled
                        ? isDarkOnLight
                          ? "text-ds2-warning-foreground hover:bg-ds2-warning-foreground/15 hover:text-ds2-warning-foreground"
                          : "text-white hover:bg-white/15 hover:text-white"
                        : "text-ds2-foreground-muted",
                      focusRingClass,
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
                      isFilled
                        ? isDarkOnLight
                          ? "text-ds2-warning-foreground hover:bg-ds2-warning-foreground/15 hover:text-ds2-warning-foreground"
                          : "text-white hover:bg-white/15 hover:text-white"
                        : "text-destructive",
                      focusRingClass,
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  {/* Sprint 13.4 — o botão "Abrir cardápio desta mesa"
                      morava dentro do Drawer (`table-drawer.tsx`), mas
                      empurrava "Fechar conta"/"Liberar mesa" pra fora da
                      tela em mesas com vários pedidos, exigindo rolar —
                      atrito real reportado no uso ("às vezes dá bug e
                      atrasa o trabalho"). Movido pra cá: 1 clique no card,
                      sem precisar abrir o Drawer primeiro — mesmo padrão
                      visual dos outros 3 ícones (QR Code/Editar/Excluir)
                      acima, só ícone, sem texto. `<a>`, não `<Button>`:
                      é link de verdade (abre em nova aba), não uma ação
                      de estado — mesmo raciocínio já usado no Drawer. */}
                  <a
                    href={tableUrl(table)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Abrir cardápio da ${table.name}`}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-ds2-sm opacity-70 hover:opacity-100",
                      isFilled
                        ? isDarkOnLight
                          ? "text-ds2-warning-foreground hover:bg-ds2-warning-foreground/15 hover:text-ds2-warning-foreground"
                          : "text-white hover:bg-white/15 hover:text-white"
                        : "text-ds2-foreground-muted",
                      focusRingClass,
                    )}
                  >
                    <UtensilsCrossed className="h-3.5 w-3.5" />
                  </a>
                </div>

                {/* 1. Número da mesa — maior elemento do card, sem dominá-lo. */}
                <span
                  className={cn(
                    "z-10 pr-14 font-numeric text-2xl font-bold leading-none tabular-nums",
                    isFilled ? (isDarkOnLight ? "text-ds2-warning-foreground" : "text-white") : "text-ds2-foreground",
                  )}
                >
                  {table.name}
                </span>

                {/* 2. Status — badge elegante com indicador de cor, nunca texto solto. */}
                <span
                  className={cn(
                    "z-10 inline-flex w-fit items-center gap-1 rounded-ds2-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
                    isFilled
                      ? isDarkOnLight
                        ? "bg-ds2-warning-foreground/15 text-ds2-warning-foreground"
                        : "bg-white/20 text-white"
                      : "bg-ds2-surface-hover text-ds2-foreground-muted ring-1 ring-inset ring-ds2-border",
                  )}
                >
                  <span className={cn("h-1 w-1 shrink-0 rounded-ds2-full", dotClass)} aria-hidden />
                  {state.label}
                </span>

                {/*
                  Selo à parte do tom, para os dois coexistirem (mesa
                  "Preparando" com pedido novo ainda em pending). Só
                  aparece quando soma informação nova — se o tom já É
                  "new_order", o card inteiro já está laranja e rotulado
                  "Novo pedido", repetir o selo seria redundante. Deixou de
                  ser o destaque principal — isso agora é a animação do
                  tile inteiro (`animate-new-order-alert` acima); o selo
                  continua existindo, com a contagem, como reforço textual.
                  Some sozinho quando o pedido sai de `pending` (mesmo sinal
                  que já governa `tone`) — nada de timer/timeout.

                  `animate-pulse` foi removido daqui de propósito — o tile
                  inteiro já pulsa (`animate-new-order-alert`, aplicado no
                  card-raiz) quando `hasUnprocessedOrders` é `true`. Duas
                  animações competindo pela atenção no mesmo elemento
                  visual; mantida só a do tile inteiro, mais visível à
                  distância — o selo permanece como reforço textual
                  estático (cor + contagem), sem movimento próprio.
                */}
                {state.hasUnprocessedOrders && state.tone !== "new_order" && (
                  <span
                    className="z-10 inline-flex w-fit items-center gap-1 rounded-ds2-full bg-ds2-warning px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-ds2-warning-foreground"
                    title="Pedido novo aguardando envio para a cozinha"
                  >
                    <Bell className="h-2.5 w-2.5 shrink-0" aria-hidden />
                    {pendingCount} {pendingCount === 1 ? "NOVO" : "NOVOS"}
                  </span>
                )}

                {/*
                  Sprint UI-01 (Migração DS2, 2026-07-31): "Chamando garçom"
                  deixou de ser um tom (`waiter_call` não existe mais em
                  `TableCardTone`) — vira só este selo independente, que
                  coexiste com qualquer tom, mesmo padrão do selo de pedido
                  não processado acima. Cor: `ds2-primary` (verde, a única
                  cor de marca da DS2) — de propósito, não `ds2-info`
                  (pedido explícito do dono: não reaproveitar "info" nem
                  criar uma cor nova só para isto). Resolver/atender a
                  chamada continua em `TableDrawer` (`waiterCallAlert`),
                  sem relação com este selo.
                */}
                {state.hasWaiterCall && (
                  <span
                    className="z-10 inline-flex w-fit items-center gap-1 rounded-ds2-full bg-ds2-primary px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-ds2-primary-foreground"
                    title="Cliente chamando o garçom"
                  >
                    <Hand className="h-2.5 w-2.5 shrink-0" aria-hidden />
                    Garçom
                  </span>
                )}

                {/* 3 + 4. Valor em aberto (se existir) e tempo, discreto. */}
                {data ? (
                  <div className="z-10 flex flex-col gap-0.5">
                    <span
                      className={cn(
                        "font-numeric text-lg font-bold leading-tight tabular-nums",
                        isFilled ? (isDarkOnLight ? "text-ds2-warning-foreground" : "text-white") : "text-ds2-foreground",
                      )}
                    >
                      {formatCurrency(data.totalAmount)}
                    </span>
                    {data.lastOrderAt && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs",
                          isFilled
                            ? isDarkOnLight
                              ? "text-ds2-warning-foreground/70"
                              : "text-white/70"
                            : "text-ds2-foreground-muted",
                        )}
                      >
                        <Clock3 className="h-2.5 w-2.5 shrink-0" aria-hidden />
                        último pedido {formatRelativeTimeShort(data.lastOrderAt)}
                      </span>
                    )}
                  </div>
                ) : (
                  <span
                    className={cn(
                      "z-10 text-xs",
                      isFilled
                        ? isDarkOnLight
                          ? "text-ds2-warning-foreground/70"
                          : "text-white/70"
                        : "text-ds2-foreground-muted",
                    )}
                  >
                    Sem pedidos em aberto
                  </span>
                )}

                {/* 5. Resumo operacional — só o que já existe (itens, pedidos). */}
                {data && (data.itemCount > 0 || ordersCount > 0) && (
                  <div
                    className={cn(
                      "z-10 flex items-center gap-2.5 text-xs",
                      isFilled
                        ? isDarkOnLight
                          ? "text-ds2-warning-foreground/80"
                          : "text-white/80"
                        : "text-ds2-foreground-muted",
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
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenTable(table);
                  }}
                  className={cn(
                    "z-10 mt-auto h-7 w-full justify-center border text-xs font-semibold",
                    isFilled
                      ? isDarkOnLight
                        ? "border-ds2-warning-foreground/25 bg-ds2-warning-foreground/10 text-ds2-warning-foreground hover:bg-ds2-warning-foreground/20"
                        : "border-white/25 bg-white/10 text-white hover:bg-white/20"
                      : "border-ds2-border bg-ds2-surface hover:bg-ds2-surface-hover",
                    focusRingClass,
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
          alerts={tableEvents[drawerTable.id] ?? []}
          acceptedPaymentMethods={acceptedPaymentMethods}
          onClose={() => setDrawerTable(null)}
          onOrdersChanged={() => void fetchOperations()}
          onAlertsChanged={() => void fetchTableEvents()}
          onTableUpdated={(updated) => {
            setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            setDrawerTable(updated);
          }}
        />
      )}
    </div>
  );
}
