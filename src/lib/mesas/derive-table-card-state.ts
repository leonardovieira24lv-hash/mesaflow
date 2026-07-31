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
 *
 * Sprint UI-01 (Migração DS2, 2026-07-31): `waiter_call` deixou de existir
 * como tom. "Chamando garçom" é um EVENTO pontual, não um estado da mesa —
 * a mesa deve continuar mostrando seu tom operacional de verdade
 * (preparando, pronto, etc.) mesmo com uma chamada pendente. Virou
 * `hasWaiterCall` em `TableCardState` (mesmo padrão de
 * `hasUnprocessedOrders`): um indicador que coexiste com qualquer tom, em
 * vez de competir por um. Também evita a DS2 (5 cores semânticas:
 * primary/success/warning/danger/info) precisar de uma sexta cor só pra
 * isso.
 */
export type TableCardTone =
  | "free" // livre
  | "maintenance" // manutenção
  | "awaiting_order" // ocupada, ainda sem nenhum pedido
  | "new_order" // tem pedido "pending" (chegou, ninguém olhou ainda)
  | "preparing" // tem pedido "preparing", nenhum "pending"
  | "ready" // nada mais pendente na cozinha — falta só fechar a conta
  | "bill_requested"; // mesa pediu a conta (evento real, via table_events)

/**
 * Um alerta pontual de mesa (chamar garçom, pedir a conta) — real desde a
 * Sprint de eventos de mesa (`docs/table-events-roadmap.md`,
 * `table_events`, `POST /api/v1/public/{slug}/tables/{token}/call-waiter`),
 * não mais um placeholder. `type: "waiter_call"` não decide mais o `tone`
 * (ver nota da Sprint UI-01 acima) — só alimenta `hasWaiterCall`.
 * `bill_request` continua decidindo o tom (`bill_requested`) — não fez
 * parte do pedido desta sprint, permanece como estava.
 */
export interface TableCardAlert {
  id: string;
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
   * tornava impossível distinguir "preparando" de "pronto".
   *
   * Sprint "Correção — Pedido Finalizado Sumindo da Mesa" (2026-07-30):
   * `fetchOperations()` agora busca `pending`/`preparing`/`ready`/`delivered`
   * (antes só os 3 primeiros). Um pedido que não é `pending` nem
   * `preparing` pode ser `ready` (legado, raro) OU `delivered` (o caso
   * comum agora: pedido finalizado manualmente, aguardando a conta
   * fechar) — os dois casos restantes por eliminação em
   * `deriveTableCardState` continuam tratados como um só estado, de
   * propósito: nos dois, não sobra nada para a cozinha fazer, só falta
   * fechar a conta. Não foi criado um `hasDeliveredOrder` separado por não
   * haver, hoje, nenhuma regra de negócio que precise distinguir os dois.
   */
  hasPreparingOrder: boolean;
}

export interface TableCardState {
  tone: TableCardTone;
  label: string;
  /**
   * Sinaliza que o tile representa algo que pede atenção imediata (conta
   * pedida, comanda pronta para fechar). Não dispara mais uma pulsação
   * contínua — o flash de transição em `TablesManager`/`TableDrawer` já
   * acontece para qualquer mudança de tom, urgente ou não. Campo mantido
   * disponível para uso futuro (ex.: destaque persistente na ordenação da
   * grade) sem precisar mudar a assinatura de `deriveTableCardState`.
   */
  pulse: boolean;
  /**
   * Sprint "Indicador de Pedido Não Processado" (2026-07-31): existe pelo
   * menos um pedido `pending` na mesa — independente de qual `tone` venceu.
   * Antes desta sprint, `hasPendingOrder` decidia sozinho o tom inteiro
   * (`new_order` sempre vencia `preparing`) — uma mesa já em preparo que
   * recebia um pedido novo pelo QR Code perdia visualmente a informação
   * "está preparando algo", porque o tom pulava inteiro para "Novo pedido".
   * Esse campo existe pra caso assim continuar mostrando o tom operacional
   * de verdade (`preparing`) e, ao mesmo tempo, sinalizar "tem pedido
   * parado em pending" através de um indicador independente — quem
   * renderiza o card decide como (badge, ponto, etc.), sem competir pelo
   * `tone`. Nome deliberadamente não-temporal ("novo"): o que importa não é
   * há quanto tempo o pedido chegou, é ele ainda não ter sido processado
   * (`pending → preparing`, "Enviar para cozinha") — desaparece nesse
   * instante, não por um timeout.
   */
  hasUnprocessedOrders: boolean;
  /**
   * Sprint UI-01 (Migração DS2, 2026-07-31): existe uma chamada de garçom
   * pendente (`table_events`, `type: "waiter_call"`) — mesmo padrão de
   * `hasUnprocessedOrders`, independente do `tone`. Antes disto, um
   * chamado de garçom virava o próprio `tone` (`"waiter_call"`, roxo),
   * escondendo o estado operacional real da mesa (uma mesa "Preparando"
   * que chamava o garçom perdia visualmente o "Preparando"). Quem
   * renderiza decide como mostrar (badge, ícone) — a resolução do alerta
   * em si (marcar como atendido) não muda, continua vivendo em
   * `TableDrawer` via `alerts`/`waiterCallAlert`, sem relação com este
   * campo.
   */
  hasWaiterCall: boolean;
}

/**
 * Decide o estado/label do tile de mesa por prioridade — o operador precisa
 * bater o olho e entender em segundos, sem ler texto (Painel de Mesas,
 * pedido do dono: "Centro de Operações").
 *
 * Prioridade: conta solicitada > manutenção > livre > (dentro de
 * "ocupada", do mais avançado operacionalmente pro menos) preparando >
 * novo pedido > pronto para fechar > aguardando pedido. "Chamando garçom"
 * não participa mais desta lista de prioridade (Sprint UI-01) — vira
 * `hasWaiterCall`, computado à parte, sempre presente independente de qual
 * tom venceu.
 *
 * Sprint "Indicador de Pedido Não Processado" (2026-07-31): `preparing`
 * passou a vencer `pending` na escolha do `tone` — antes era o contrário
 * (`hasPendingOrder` sempre ganhava), o que fazia uma mesa já em preparo
 * "perder" esse tom assim que um pedido novo chegava pelo QR Code. O tom
 * `new_order` continua existindo — só aparece quando pending é o único
 * sinal (mesa nova, primeiro pedido, nada em preparo ainda), exatamente o
 * caso em que ele já era o mais informativo. `hasUnprocessedOrders` (ver
 * `TableCardState`) cobre o caso misto, independente de qual tom venceu.
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
  const hasUnprocessedOrders = data?.hasPendingOrder ?? false;
  const hasWaiterCall = alerts.some((a) => a.type === "waiter_call");

  if (alerts.some((a) => a.type === "bill_request")) {
    return { tone: "bill_requested", label: "Conta solicitada", pulse: true, hasUnprocessedOrders, hasWaiterCall };
  }

  if (status === "manutencao") {
    return { tone: "maintenance", label: "Manutenção", pulse: false, hasUnprocessedOrders, hasWaiterCall };
  }

  if (status === "livre") {
    return { tone: "free", label: "Livre", pulse: false, hasUnprocessedOrders, hasWaiterCall };
  }

  if (!data) {
    return { tone: "awaiting_order", label: "Aguardando pedido", pulse: false, hasUnprocessedOrders, hasWaiterCall };
  }

  if (data.hasPreparingOrder) {
    return { tone: "preparing", label: "Preparando", pulse: false, hasUnprocessedOrders, hasWaiterCall };
  }

  if (data.hasPendingOrder) {
    return { tone: "new_order", label: "Novo pedido", pulse: true, hasUnprocessedOrders, hasWaiterCall };
  }

  // Só sobra "ready" por eliminação: `data` existe (há comanda aberta),
  // não é pending nem preparing. Antes da Sprint "Correção — Pedido
  // Finalizado Sumindo da Mesa" isso só podia ser um pedido "ready"
  // legado. Hoje `fetchOperations()` também traz pedidos "delivered", que
  // caem aqui do mesmo jeito — e é o caso comum agora (pedido finalizado
  // manualmente, aguardando fechar a conta). Rótulo trocado de "Pronto
  // para servir" para não instruir o operador a servir algo que, no caso
  // comum, já foi servido.
  return { tone: "ready", label: "Pronto para fechar", pulse: true, hasUnprocessedOrders, hasWaiterCall };
}

/**
 * Tons sólidos para o tile inteiro (grade de Mesas e cabeçalho do Drawer).
 * Valores usam os tokens `ds2-*` (`tailwind.config.ts`/`app/globals.css`,
 * classe `.ds2-dark`, aplicada na raiz do shell administrativo).
 *
 * `waiter_call` não existe nesta paleta — deixou de ser tom, ver
 * `hasWaiterCall`/comentário no topo do arquivo.
 *
 * Paleta (7 estados):
 * - `free`/`maintenance`: sem preenchimento (cinza elegante / opaco).
 * - `awaiting_order`: só contorno na cor da marca — mesa ocupada mas sem
 *   nada acontecendo ainda não deveria competir visualmente com os estados
 *   de progresso do pedido.
 * - `new_order`: `ds2-warning` — precisa ser o mais chamativo (algo novo
 *   chegou). Foreground é `ds2-warning-foreground` (escuro), não branco —
 *   `ds2-warning` é um tom claro.
 * - `preparing`: `ds2-info`.
 * - `ready`: `ds2-success` — sinaliza "nada pendente na cozinha, falta
 *   fechar a conta" (cobre tanto pedido `ready` legado quanto o caso comum
 *   hoje, comanda com tudo `delivered`).
 * - `bill_requested`: `ds2-danger`.
 */
export const TABLE_CARD_TONE_CLASSES: Record<TableCardTone, string> = {
  free: "border-ds2-border bg-ds2-surface",
  maintenance: "border-ds2-border bg-ds2-surface-hover opacity-75",
  awaiting_order: "border-ds2-primary/50 bg-ds2-surface",
  new_order: "border-transparent bg-ds2-warning text-ds2-warning-foreground",
  preparing: "border-transparent bg-ds2-info text-ds2-info-foreground",
  ready: "border-transparent bg-ds2-success text-ds2-success-foreground",
  bill_requested: "border-transparent bg-ds2-danger text-ds2-danger-foreground",
};

/**
 * Tiles com tom preenchido usam texto claro para os textos secundários
 * (itens, tempo) — `awaiting_order` fica de fora de propósito: é só
 * contorno, não preenchimento, então continua usando as cores neutras de
 * texto.
 *
 * `new_order` usa `ds2-warning-foreground` ESCURO (fundo claro), diferente
 * dos outros três (fundo escuro, texto claro) — ver
 * `TABLE_CARD_TONE_DARK_TEXT` abaixo, que `TablesManager`/`TableDrawer`
 * consultam para escolher a variante certa de texto por tom.
 */
export const TABLE_CARD_FILLED_TONES: readonly TableCardTone[] = ["new_order", "preparing", "ready", "bill_requested"];

export const TABLE_CARD_TONE_DOT_CLASSES: Record<TableCardTone, string> = {
  free: "bg-ds2-foreground-muted/40",
  maintenance: "bg-ds2-foreground-muted/40",
  awaiting_order: "bg-ds2-primary/60",
  new_order: "bg-ds2-warning",
  preparing: "bg-ds2-info",
  ready: "bg-ds2-success",
  bill_requested: "bg-ds2-danger",
};

/**
 * Textos/ícones secundários de um tile preenchido (`TABLE_CARD_FILLED_TONES`)
 * não podem assumir texto branco de forma genérica: verdade para
 * `preparing`/`ready`/`bill_requested` (fundo escuro, `ds2-*-foreground` é
 * branco mesmo), mas o oposto para `new_order`: `ds2-warning` é um fundo
 * CLARO, `ds2-warning-foreground` é escuro (`0 0% 8%`). Esta lista existe
 * pra `TablesManager`/`TableDrawer` saberem qual dos dois casos aplicar —
 * é a distinção real entre os tons, não um caso especial temporário. Se um
 * tom novo de fundo claro for adicionado no futuro, ele entra aqui.
 */
export const TABLE_CARD_TONE_DARK_TEXT: readonly TableCardTone[] = ["new_order"];
