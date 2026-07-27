import type { TableStatus } from "@/types/domain";

/**
 * Sprint "Fluxo Operacional das Mesas" (item 1 do checklist) — o tom deixou
 * de ser um nome de cor (`success`/`warning`/`info`...) e passou a ser um
 * identificador de ESTADO. Antes, `success`/`warning`/`info`/`destructive`
 * misturavam "o que está acontecendo" com "que cor isso usa" — e como só
 * existiam 6 valores, os dois já reservados para o roadmap futuro
 * (`info` = garçom chamado, `destructive` = conta pedida) deixavam só 2
 * livres (`success`/`warning`) para representar TODO o progresso real de um
 * pedido (aguardando → novo → preparando → pronto), forçando dois estágios
 * bem diferentes (preparando e pronto) a compartilhar a mesma cor.
 *
 * Com o tom sendo o próprio nome do estado, cada estágio tem sua própria
 * entrada dedicada em `TABLE_CARD_TONE_CLASSES`/`TABLE_CARD_TONE_DOT_CLASSES`
 * — acrescentar um estágio novo no futuro (ex.: "aguardando pagamento") vira
 * só mais uma chave nesses mapas, nunca mais uma disputa por cor reservada.
 */
export type TableCardTone =
  | "free" // livre
  | "maintenance" // manutenção
  | "awaiting_order" // ocupada, ainda sem nenhum pedido
  | "new_order" // tem pedido "pending" (chegou, ninguém olhou ainda)
  | "preparing" // tem pedido "preparing", nenhum "pending"
  | "ready" // todos os pedidos em aberto já estão "ready"
  | "waiter_call" // reservado — sem backend ainda, ver docs/table-events-roadmap.md
  | "bill_requested"; // reservado — sem backend ainda, ver docs/table-events-roadmap.md

/**
 * Um alerta pontual de mesa (chamar garçom, pedir a conta). Não existe
 * backend para isso hoje — ver `docs/table-events-roadmap.md` para o que
 * falta (tabela `table_events`, endpoints, canal Realtime). Este tipo e a
 * lista `alerts` abaixo já modelam o formato que esse dado vai ter quando
 * existir, para que ligar o backend real não exija tocar em
 * `deriveTableCardState` nem no `TableCard` — só passar uma lista não-vazia
 * onde hoje sempre chega `[]`.
 */
export interface TableCardAlert {
  type: "waiter_call" | "bill_request";
  createdAt: string;
}

export interface TableOperationalData {
  totalAmount: number;
  itemCount: number;
  lastOrderAt: string | null;
  /** Existe pelo menos um pedido em aberto com status "pending". */
  hasPendingOrder: boolean;
  /**
   * Existe pelo menos um pedido em aberto com status "preparing". Novo
   * campo (item 1 do checklist) — antes só `hasPendingOrder` existia, o que
   * tornava impossível distinguir "preparando" de "pronto". Como
   * `fetchOperations()` só busca pedidos `pending`/`preparing`/`ready`, um
   * pedido que não é `pending` nem `preparing` só pode ser `ready` — por
   * isso não existe um `hasReadyOrder` explícito, é o caso restante por
   * eliminação em `deriveTableCardState`.
   */
  hasPreparingOrder: boolean;
}

export interface TableCardState {
  tone: TableCardTone;
  label: string;
  /**
   * Sinaliza que o tile representa algo que pede atenção imediata (pedido
   * novo, garçom chamado, conta pedida, pedido pronto para servir). Não
   * dispara mais uma pulsação contínua — o flash de transição em
   * `TablesManager`/`TableDrawer` já acontece para qualquer mudança de tom,
   * urgente ou não. Campo mantido disponível para uso futuro (ex.: destaque
   * persistente na ordenação da grade) sem precisar mudar a assinatura de
   * `deriveTableCardState`.
   */
  pulse: boolean;
}

/**
 * Decide o estado/label do tile de mesa por prioridade — o operador precisa
 * bater o olho e entender em segundos, sem ler texto (Painel de Mesas,
 * pedido do dono: "Centro de Operações").
 *
 * Prioridade: conta solicitada > garçom chamado > manutenção > livre >
 * (dentro de "ocupada", do mais urgente pro mais resolvido) novo pedido >
 * preparando > pronto para servir > aguardando pedido. Os dois primeiros
 * nunca disparam hoje (`alerts` sempre chega `[]` — sem backend, ver
 * acima), mas a ordem já está certa para quando existirem.
 *
 * "Aguardando pedido" é o estado de uma mesa `ocupada` sem NENHUM pedido
 * ainda (`data` chega `null`) — ex.: atendente abriu a mesa para um cliente
 * que ainda não pediu pelo QR Code. Diferente de "novo pedido"
 * (`hasPendingOrder`), que exige um pedido real já existir.
 */
export function deriveTableCardState(
  status: TableStatus,
  data: TableOperationalData | null,
  alerts: TableCardAlert[],
): TableCardState {
  if (alerts.some((a) => a.type === "bill_request")) {
    return { tone: "bill_requested", label: "Conta solicitada", pulse: true };
  }

  if (alerts.some((a) => a.type === "waiter_call")) {
    return { tone: "waiter_call", label: "Chamando garçom", pulse: true };
  }

  if (status === "manutencao") {
    return { tone: "maintenance", label: "Manutenção", pulse: false };
  }

  if (status === "livre") {
    return { tone: "free", label: "Livre", pulse: false };
  }

  if (!data) {
    return { tone: "awaiting_order", label: "Aguardando pedido", pulse: false };
  }

  if (data.hasPendingOrder) {
    return { tone: "new_order", label: "Novo pedido", pulse: true };
  }

  if (data.hasPreparingOrder) {
    return { tone: "preparing", label: "Preparando", pulse: false };
  }

  // Só sobra "ready" por eliminação: `data` existe (há pedido em aberto),
  // não é pending nem preparing — `fetchOperations()` só traz essas 3
  // possibilidades, então o que resta é "ready".
  return { tone: "ready", label: "Pronto para servir", pulse: true };
}

/**
 * Tons sólidos para o tile inteiro (grade de Mesas e cabeçalho do Drawer).
 * Deliberadamente mais dessaturados que os tokens semânticos globais
 * (`--success`/`--warning`/`--info`/`--destructive`, usados em Badge/Toast/
 * Alert/Dashboard) — em badges pequenos a cor vibrante ajuda a chamar
 * atenção, mas preenchendo um card inteiro o mesmo tom fica com aspecto de
 * alerta/erro em vez de software profissional. Valores isolados aqui (não
 * tokens globais) para não afetar nenhum outro componente do design system.
 *
 * Paleta (item 1 do checklist, 8 estados):
 * - `free`/`maintenance`: sem preenchimento (cinza elegante / opaco).
 * - `awaiting_order`: só contorno na cor da marca — mesa ocupada mas sem
 *   nada acontecendo ainda não deveria competir visualmente com os estados
 *   de progresso do pedido.
 * - `new_order`: laranja — precisa ser o mais chamativo (algo novo chegou).
 * - `preparing`: azul — mesmo matiz do badge `AdminOrderStatusBadge` para
 *   pedido "Preparando" (`ui/badge.tsx`), para o operador nunca ver cores
 *   diferentes para o mesmo status em telas diferentes.
 * - `ready`: verde — mesma lógica, espelha o badge "Pronto".
 * - `waiter_call`/`bill_requested`: violeta/vermelho, cores próprias (sem
 *   backend ainda, mas já reservadas e sem colidir com as de progresso do
 *   pedido acima).
 */
export const TABLE_CARD_TONE_CLASSES: Record<TableCardTone, string> = {
  free: "border-border bg-surface",
  maintenance: "border-border bg-muted/60 opacity-75",
  awaiting_order: "border-primary/50 bg-surface",
  new_order: "border-transparent bg-[hsl(16_78%_46%)] text-white",
  preparing: "border-transparent bg-[hsl(212_55%_38%)] text-white",
  ready: "border-transparent bg-[hsl(142_45%_32%)] text-white",
  waiter_call: "border-transparent bg-[hsl(270_50%_42%)] text-white",
  bill_requested: "border-transparent bg-[hsl(355_55%_40%)] text-white",
};

/** Tiles com tom preenchido usam texto branco — precisa de uma variante "clara" para os textos secundários (itens, tempo). `awaiting_order` fica de fora de propósito: é só contorno, não preenchimento, então continua usando as cores neutras de texto. */
export const TABLE_CARD_FILLED_TONES: readonly TableCardTone[] = [
  "new_order",
  "preparing",
  "ready",
  "waiter_call",
  "bill_requested",
];

export const TABLE_CARD_TONE_DOT_CLASSES: Record<TableCardTone, string> = {
  free: "bg-muted-foreground/40",
  maintenance: "bg-muted-foreground/40",
  awaiting_order: "bg-primary/60",
  new_order: "bg-warning",
  preparing: "bg-info",
  ready: "bg-success",
  waiter_call: "bg-[hsl(270_60%_65%)]",
  bill_requested: "bg-destructive",
};
