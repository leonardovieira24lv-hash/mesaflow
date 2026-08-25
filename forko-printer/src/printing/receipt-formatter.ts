import type { PrintDocument, PaperWidth, ReceiptLine } from "../types.js";
import { charsPerLine } from "./paper-width.js";

/**
 * FORKO Printer — Etapa 5B (2026-08-24). Camada de CONTEÚDO — decide O
 * QUE vai em cada linha da comanda, nunca COMO isso vira bytes (isso é
 * `esc-pos-renderer.ts`) nem como esses bytes chegam na impressora
 * (`transport/`). `ReceiptFormatter` não sabe que ESC/POS existe.
 *
 * Layout desta etapa (pedido explícito: "ainda não é o layout final,
 * mas precisa ser operacionalmente legível"):
 *
 *   RESTAURANTE
 *   PEDIDO #...
 *   MESA ...
 *   HORÁRIO
 *   ----------------
 *   2x PRODUTO
 *      nota
 *      nota
 *   ----------------
 *   [próximo item...]
 *   OBSERVAÇÃO: texto (só se `orderNotes` existir)
 *
 * Limitação conhecida (documentada, não escondida): `PrintDocumentItem.notes`
 * já vem "achatado" do backend (`build_print_document_snapshot()`, migration
 * `0053` — fora do escopo desta etapa, "NÃO mexer no backend") — meio a
 * meio, opções escolhidas e a observação livre do item chegam aqui como
 * strings simples, sem marcador de qual é qual. Por isso todas as notas
 * de um item são renderizadas do mesmo jeito (indentadas, sem prefixo
 * "OBS:" individual) — distinguir isso exigiria mudar o snapshot no
 * banco, que esta etapa não toca.
 */
export function buildReceiptLines(document: PrintDocument, paperWidth: PaperWidth): ReceiptLine[] {
  const width = charsPerLine(paperWidth);
  const separator: ReceiptLine = { text: "-".repeat(width) };
  const lines: ReceiptLine[] = [];

  lines.push({ text: document.header.restaurantName, bold: true, align: "center" });
  lines.push({ text: document.header.orderLabel, bold: true });
  lines.push({ text: document.header.tableLabel, bold: true, doubleWidth: true });
  lines.push({ text: document.header.timeLabel });
  lines.push(separator);

  for (const item of document.items) {
    const manualTag = item.isManualItem ? " (avulso)" : "";
    lines.push({ text: `${item.quantity}x ${item.name}${manualTag}`, bold: true });
    for (const note of item.notes) {
      lines.push({ text: `   ${note}` });
    }
    lines.push(separator);
  }

  if (document.orderNotes) {
    lines.push({ text: "OBSERVAÇÃO:", bold: true });
    lines.push({ text: document.orderNotes, doubleWidth: true });
  }

  return lines;
}
