/**
 * FORKO Printer — Etapa 1 (2026-08-24). Contrato de LEITURA do `jsonb`
 * já persistido em `print_jobs.document` — não existe nenhuma função
 * TypeScript que CONSTRÓI este formato nesta etapa (decisão da Fase 2:
 * o snapshot é montado inteiro dentro da mesma transação SQL do trigger,
 * `build_print_document_snapshot()`, ver
 * `supabase/migrations/0053_print_jobs_foundation.sql` — nunca em
 * TypeScript, pra não ter 2 implementações concorrentes da mesma regra).
 *
 * Estes tipos existem só pra quem FUTURAMENTE for LER um `print_jobs.document`
 * já pronto (o agente/Printer, uma tela de acompanhamento, etc.) ter o
 * formato correto sem precisar adivinhar a forma do jsonb.
 */

/** Onde o trabalho deve ser impresso. Só 'kitchen' tem uso real neste MVP
 *  (ajuste da Fase 2, item 6) — 'bar' existe no CHECK do banco pensando no
 *  futuro, mas nenhum roteamento por categoria é implementado agora. */
export type PrintDestination = "kitchen" | "bar";

/**
 * Ciclo de vida do trabalho de impressão (Fase 2, item 4).
 *   pending    → job existe, nenhum agente reivindicou ainda.
 *   processing → um agente (futuro) reivindicou o job (claim atômico,
 *                ainda não implementado nesta etapa) e está tentando.
 *   printed    → terminal, sucesso.
 *   failed     → terminal, mas alcançável de volta por retry manual
 *                (fora do escopo desta etapa).
 */
export type PrintJobStatus = "pending" | "processing" | "printed" | "failed";

/**
 * Um item do documento — já filtrado (só itens ATIVOS entram no snapshot,
 * `cancelled_at is null` — ajuste desta rodada) e já com toda nota
 * (opções escolhidas, meio a meio, observação livre) resolvida em texto
 * simples, uma linha por elemento de `notes`.
 *
 * Sem campo `cancelled` de propósito — itens cancelados nunca chegam a
 * existir no documento (filtrados na origem, no SQL), então um campo
 * "isto está cancelado?" aqui dentro nunca teria um consumidor real:
 * seria sempre `false`. Informação sem utilidade não entra no contrato.
 */
export interface PrintDocumentItem {
  quantity: number;
  name: string;
  /** `true` quando o item não veio do cardápio (`order_items.menu_item_id
   *  is null` — "item avulso", `0050`/`0051`/`0052`). */
  isManualItem: boolean;
  notes: string[];
}

/**
 * O documento de impressão — representação independente de hardware do
 * QUE deve ser impresso, congelada no momento da criação do job (nunca
 * recalculada depois, mesmo que o pedido mude).
 */
export interface PrintDocument {
  header: {
    restaurantName: string;
    /** Ex.: "PEDIDO #A3F91C02" — 8 primeiros caracteres do `orders.id`
     *  (uuid), maiúsculos. O FORKO não tem número sequencial de pedido;
     *  isto é só uma etiqueta curta de exibição, não um identificador
     *  único por si só (o `orders.id` completo é quem garante isso). */
    orderLabel: string;
    tableLabel: string;
    /** Já formatado, ex. "19:42" — horário de criação do PEDIDO
     *  (`orders.created_at`), não do job. */
    timeLabel: string;
  };
  items: PrintDocumentItem[];
  /** `orders.notes` — observação geral do pedido, não de um item
   *  específico. `null` se o pedido não tiver nenhuma. */
  orderNotes: string | null;
}

/** Forma de um `print_jobs` já persistido, em camelCase (mesmo padrão de
 *  conversão já usado no resto do domínio do projeto). */
export interface PrintJob {
  id: string;
  restaurantId: string;
  orderId: string;
  tableId: string | null;
  destination: PrintDestination;
  document: PrintDocument;
  status: PrintJobStatus;
  attemptCount: number;
  nextAttemptAt: string | null;
  /** Referencia `printer_devices.id` desde a Etapa 2A
   *  (`0054_printer_devices_and_claim.sql`) — `null` enquanto o job não
   *  foi reivindicado, ou depois que um lease expirado é recuperado. */
  claimedBy: string | null;
  claimedAt: string | null;
  leaseExpiresAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  printedAt: string | null;
}

/**
 * Etapa 2C (2026-08-24). `print_jobs.document` volta do Supabase como
 * `jsonb` já desserializado (objeto JS comum, não string) — mas
 * tipado fracamente pelo client (`database.types.ts` é placeholder,
 * `Database = any`). Este guard evita que um `as PrintDocument` cego se
 * espalhe pelas rotas que devolvem o documento pro Printer — checagem de
 * forma rasa (não revalida cada campo/item), suficiente pra pegar o caso
 * real de preocupação: o `jsonb` vir nulo/malformado por algum motivo
 * inesperado, sem precisar de uma dependência de schema runtime só pra
 * isso (pedido explícito: não criar dependência nova).
 */
export function isPrintDocument(value: unknown): value is PrintDocument {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.header === "object" &&
    v.header !== null &&
    Array.isArray(v.items) &&
    (v.orderNotes === null || typeof v.orderNotes === "string")
  );
}
