/**
 * FORKO Printer — Etapa 3A (2026-08-24). Tipos espelhando os contratos
 * REAIS do backend, confirmados lendo o código antes de escrever
 * qualquer coisa aqui (não presumidos de nenhuma etapa anterior):
 * `src/types/printing.ts` e as 3 rotas reais
 * (`pair`/`jobs/claim`/`jobs/[id]/result`) do projeto principal.
 */

export interface PrintDocumentItem {
  quantity: number;
  name: string;
  isManualItem: boolean;
  notes: string[];
}

export interface PrintDocument {
  header: {
    restaurantName: string;
    orderLabel: string;
    tableLabel: string;
    timeLabel: string;
  };
  items: PrintDocumentItem[];
  orderNotes: string | null;
}

/** Forma exata devolvida por `POST /jobs/claim` (campo `job`, quando
 *  existe) — conferida direto em
 *  `src/app/api/v1/printer/jobs/claim/route.ts`. */
export interface ClaimedJob {
  id: string;
  destination: string;
  document: PrintDocument;
  attemptCount: number;
  leaseExpiresAt: string;
}

export type ResultStatus = "printed" | "failed";

/** Corpo exato esperado por `POST /jobs/{id}/result` — conferido contra
 *  `printJobResultSchema` real (`src/lib/validations/printer.ts`). */
export interface PrintJobResultRequest {
  status: ResultStatus;
  retryable?: boolean;
  errorCode?: string;
  errorMessage?: string;
}

/** Envelope padrão de sucesso do FORKO (`apiSuccess`/`apiCreated`, seção
 *  1.3 do contrato) — `{ data: T }`, sempre. */
export interface ApiEnvelope<T> {
  data: T;
}

/** Envelope padrão de erro (`handleRouteError`) — `{ error: { code,
 *  message } }`, sempre. */
export interface ApiErrorEnvelope {
  error: { code: string; message: string };
}

/** Configuração local persistida — `adapter`/`printer` são OPCIONAIS de
 *  propósito (Etapa 5B/5C): `loadConfig()` faz um cast direto
 *  (`JSON.parse(...) as AgentConfig`), sem validação de schema — uma
 *  config antiga (Etapa 3A/3B, sem esses campos) continua carregando
 *  normalmente, com os dois como `undefined`. `resolvePrintAdapter()`
 *  (`index.ts`) trata a ausência como `"mock"` — comportamento atual
 *  preservado, pedido explícito ("configs antigas não podem quebrar"). */
export interface AgentConfig {
  serverUrl: string;
  deviceId: string;
  deviceToken: string;
  deviceName: string;
  adapter?: "mock" | "tcp" | "windows";
  printer?: TcpPrinterConfig | WindowsPrinterConfig;
}

/** `port`/`paperWidth`/`hasCutter` também opcionais aqui — os defaults
 *  reais (9100/80/false) ficam em `resolvePrintAdapter()`, não
 *  duplicados nesta interface. */
export interface TcpPrinterConfig {
  host: string;
  port?: number;
  paperWidth?: PaperWidth;
  hasCutter?: boolean;
}

/** Etapa 5C — impressora JÁ instalada no Windows (spooler), identificada
 *  pelo NOME exibido em "Dispositivos e Impressoras", não por IP/porta. */
export interface WindowsPrinterConfig {
  name: string;
  paperWidth?: PaperWidth;
  hasCutter?: boolean;
}

/** Largura do papel — únicas 2 opções reais no mercado. Nenhum "número
 *  mágico" solto: `charsPerLine()` (`printing/paper-width.ts`) é o
 *  único lugar que sabe quantos caracteres cabem em cada largura. */
export type PaperWidth = 58 | 80;

export type ReceiptAlign = "left" | "center" | "right";

/** Estrutura intermediária entre o CONTEÚDO (`PrintDocument`) e o
 *  PROTOCOLO (bytes ESC/POS) — `ReceiptFormatter` produz isto,
 *  `EscPosRenderer` consome. Nenhuma das duas pontas conhece a outra
 *  diretamente. */
export interface ReceiptLine {
  text: string;
  bold?: boolean;
  doubleWidth?: boolean;
  align?: ReceiptAlign;
}

/**
 * Erro tipado de adapter (pedido explícito, Etapa 5B) — substitui o
 * `errorCode: "mock_failure"` que estava fixo em `processJob`
 * (`index.ts`) não importa qual adapter falhasse, achado na auditoria
 * desta etapa. Qualquer `PrintAdapter` (mock, tcp, futuros) pode lançar
 * isto pra reportar o motivo real ao servidor — `processJob` lê
 * `code`/`retryable` daqui quando disponível, e só cai num fallback
 * genérico se o adapter lançar um `Error` comum.
 */
export class PrintAdapterError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = true) {
    super(message);
    this.name = "PrintAdapterError";
    this.code = code;
    this.retryable = retryable;
  }
}

/** Uma entrada do journal local. `ackStatus` (Etapa 3B) é o que
 *  distingue "imprimi mas ainda não confirmei ao servidor" de "imprimi
 *  e o servidor já sabe" — sem isso, um crash exatamente entre o print
 *  e o ACK deixava o journal "certo" (`status: printed`) mas sem
 *  sinalizar que o ACK ainda precisava ser reenviado; com `ackStatus`,
 *  o agente sabe exatamente o que fazer ao reencontrar esse job: nunca
 *  reimprimir, só reenviar o ACK que ficou pendente. */
export interface JournalEntry {
  jobId: string;
  status: "printed";
  printedAt: string;
  ackStatus: "pending" | "confirmed";
  orderLabel: string;
}
