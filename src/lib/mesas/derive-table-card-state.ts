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
 *
 * Nova geração visual (redesign estrutural): abandonado o modelo anterior
 * de "preenchimento saturado" (fundo laranja/azul/verde vibrante) e
 * "contorno = livre/aguardando" — cada mesa agora é um bloco sólido de
 * grafite profundo (`ds2-background`), sempre, com uma tonalidade sutil
 * (`from-{cor}/10` a `/15`) comunicando o estado. Nunca mais "só contorno"
 * como único indicador — mesmo `free` tem preenchimento sólido, só sem
 * tonalidade (grafite puro).
 *
 * Mapeamento de cor (paleta oficial, sem dourado, sem azul como segunda
 * cor de marca):
 * - `free`: grafite neutro, sem tonalidade.
 * - `maintenance`: grafite com leve vermelho — "manutenção/urgência".
 * - `awaiting_order`/`preparing`/`ready`: grafite com leve verde — os três
 *   são "mesa ocupada, operação em andamento, nada fora do normal";
 *   antes eram 3 tratamentos visuais diferentes (contorno, azul, verde
 *   saturado), agora é um único bucket "ocupada".
 * - `new_order`: grafite com leve laranja — "novo pedido/atenção".
 * - `bill_requested`: grafite com leve vermelho — mesmo bucket de
 *   `maintenance` ("urgência"), mais intenso por ser realmente acionável.
 *
 * Como todo tom agora tem fundo escuro (nunca mais um fundo claro tipo
 * `ds2-warning` puro), o texto secundário é sempre claro — por isso
 * `TABLE_CARD_TONE_DARK_TEXT` (abaixo) fica vazio: nenhum tom precisa mais
 * da variante de texto escuro.
 */
export const TABLE_CARD_TONE_CLASSES: Record<TableCardTone, string> = {
  free: "border border-ds2-border bg-ds2-background",
  maintenance: "border border-ds2-danger/20 bg-gradient-to-br from-ds2-danger/10 via-ds2-background to-ds2-background opacity-90",
  awaiting_order: "border border-ds2-success/20 bg-gradient-to-br from-ds2-success/10 via-ds2-background to-ds2-background",
  new_order: "border border-ds2-warning/25 bg-gradient-to-br from-ds2-warning/15 via-ds2-background to-ds2-background",
  preparing: "border border-ds2-success/20 bg-gradient-to-br from-ds2-success/10 via-ds2-background to-ds2-background",
  ready: "border border-ds2-success/25 bg-gradient-to-br from-ds2-success/15 via-ds2-background to-ds2-background",
  bill_requested: "border border-ds2-danger/30 bg-gradient-to-br from-ds2-danger/20 via-ds2-background to-ds2-background",
};

/**
 * Todo tom agora é um card sólido (fundo escuro sempre) — não sobra
 * nenhum tom "só contorno" fora desta lista, então ela passou a incluir
 * os 7. O mecanismo (`isFilled` nos arquivos que consomem) continua
 * existindo e é consultado do mesmo jeito; só os dados aqui mudaram.
 */
export const TABLE_CARD_FILLED_TONES: readonly TableCardTone[] = [
  "free",
  "maintenance",
  "awaiting_order",
  "new_order",
  "preparing",
  "ready",
  "bill_requested",
];

export const TABLE_CARD_TONE_DOT_CLASSES: Record<TableCardTone, string> = {
  free: "bg-ds2-foreground-muted/40",
  maintenance: "bg-ds2-danger",
  awaiting_order: "bg-ds2-success/70",
  new_order: "bg-ds2-warning",
  preparing: "bg-ds2-success/70",
  ready: "bg-ds2-success",
  bill_requested: "bg-ds2-danger",
};

/**
 * Nenhum tom tem fundo claro na nova paleta (todos são grafite profundo)
 * — lista vazia, de propósito. O mecanismo que a consulta
 * (`TablesManager`/`TableDrawer`) continua exatamente como estava; se um
 * tom de fundo claro voltar a existir no futuro, ele entra aqui de novo.
 */
export const TABLE_CARD_TONE_DARK_TEXT: readonly TableCardTone[] = [];
