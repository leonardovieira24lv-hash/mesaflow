import type { PrintDocument } from "../types.js";

/**
 * FORKO Printer — Etapa 3A (2026-08-24). Contrato que qualquer
 * mecanismo físico futuro (ESC/POS, USB, impressora de rede) vai
 * precisar cumprir — hoje só o `MockPrintAdapter` existe. `print()`
 * lança em caso de falha; quem chama (`index.ts`) decide o que fazer
 * com isso (reportar `failed`/`retryable` pro servidor).
 */
export interface PrintAdapter {
  print(jobId: string, document: PrintDocument, attemptCount: number): Promise<void>;
}
