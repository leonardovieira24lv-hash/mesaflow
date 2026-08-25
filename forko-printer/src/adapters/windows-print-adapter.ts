import type { PrintDocument, PaperWidth } from "../types.js";
import type { PrintAdapter } from "./print-adapter.js";
import { buildReceiptLines } from "../printing/receipt-formatter.js";
import { renderEscPos } from "../printing/esc-pos-renderer.js";
import { sendViaWindowsSpooler } from "../transport/windows-transport.js";

/**
 * FORKO Printer — Etapa 5C (2026-08-24). Terceiro `PrintAdapter` —
 * MESMA composição do `TcpPrintAdapter` (Etapa 5B), só trocando a
 * camada de TRANSPORTE. `ReceiptFormatter`/`EscPosRenderer` são
 * reaproveitados sem nenhuma duplicação de layout/comando ESC/POS
 * (pedido explícito) — só o "último passo" (como os bytes chegam na
 * impressora) muda entre TCP e Windows.
 *
 * Mesma regra de isolamento do TCP: não conhece API do FORKO, token,
 * `print_jobs`, journal nem ACK.
 */
export interface WindowsPrintAdapterOptions {
  printerName: string;
  paperWidth: PaperWidth;
  hasCutter: boolean;
}

export class WindowsPrintAdapter implements PrintAdapter {
  constructor(private readonly options: WindowsPrintAdapterOptions) {}

  async print(_jobId: string, document: PrintDocument): Promise<void> {
    const lines = buildReceiptLines(document, this.options.paperWidth);
    const bytes = renderEscPos(lines, this.options.hasCutter);
    await sendViaWindowsSpooler(bytes, this.options.printerName);
  }
}
