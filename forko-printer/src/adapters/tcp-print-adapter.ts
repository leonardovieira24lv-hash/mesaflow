import type { PrintDocument, PaperWidth } from "../types.js";
import type { PrintAdapter } from "./print-adapter.js";
import { buildReceiptLines } from "../printing/receipt-formatter.js";
import { renderEscPos } from "../printing/esc-pos-renderer.js";
import { sendViaTcp } from "../transport/tcp-transport.js";

/**
 * FORKO Printer — Etapa 5B (2026-08-24). Segundo `PrintAdapter` real —
 * compõe as 3 camadas (`ReceiptFormatter → EscPosRenderer → Transport`),
 * sem misturar responsabilidades entre elas.
 *
 * Não conhece a API do FORKO, token, `print_jobs`, journal nem ACK
 * (pedido explícito) — só recebe `document`, devolve uma `Promise` que
 * resolve em sucesso ou lança `PrintAdapterError` em falha. Tudo que
 * envolve o ciclo de vida do job (`journal`, `reportResult`) continua
 * em `index.ts`, sem mudança nenhuma na forma como isso funciona.
 */
export interface TcpPrintAdapterOptions {
  host: string;
  port: number;
  paperWidth: PaperWidth;
  hasCutter: boolean;
}

export class TcpPrintAdapter implements PrintAdapter {
  constructor(private readonly options: TcpPrintAdapterOptions) {}

  async print(_jobId: string, document: PrintDocument): Promise<void> {
    const lines = buildReceiptLines(document, this.options.paperWidth);
    const bytes = renderEscPos(lines, this.options.hasCutter);
    await sendViaTcp(bytes, { host: this.options.host, port: this.options.port });
  }
}
