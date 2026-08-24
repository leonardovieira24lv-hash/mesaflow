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

/** Configuração local persistida — só o que foi pedido: serverUrl,
 *  deviceId, deviceToken, deviceName. Nada além disso. */
export interface AgentConfig {
  serverUrl: string;
  deviceId: string;
  deviceToken: string;
  deviceName: string;
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
