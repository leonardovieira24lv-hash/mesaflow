import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { PrintDocument } from "../types.js";
import type { PrintAdapter } from "./print-adapter.js";
import { DATA_DIR } from "../journal.js";

/**
 * FORKO Printer — Etapa 3A/3B (2026-08-24). Não imprime fisicamente —
 * grava uma representação textual legível em `data/prints/<job-id>.txt`.
 * `PRINTS_DIR` deriva do MESMO `DATA_DIR` que o journal usa (`journal.ts`)
 * — uma fonte só pro caminho de `data/`, evitando 2 constantes
 * calculando o mesmo caminho de jeitos diferentes.
 *
 * Falhas simuladas (Etapa 3B):
 *   `FORKO_MOCK_FAIL=true`       → sempre falha.
 *   `FORKO_MOCK_FAIL_ONCE=true`  → falha só na 1ª tentativa. Usa o
 *     `attemptCount` que o PRÓPRIO SERVIDOR já manda em cada job
 *     reivindicado (Etapa 2C — incrementado no claim) em vez de guardar
 *     um contador local à parte — nada pra ficar dessincronizado entre
 *     agente e servidor sobre "quantas vezes isso já foi tentado".
 */

const PRINTS_DIR = path.join(DATA_DIR, "prints");

function renderDocument(document: PrintDocument): string {
  const lines: string[] = [];
  const divider = "=".repeat(32);

  lines.push(divider);
  lines.push("FORKO — MOCK PRINT");
  lines.push(divider);
  lines.push(document.header.restaurantName);
  lines.push(document.header.orderLabel);
  lines.push(document.header.tableLabel);
  lines.push(document.header.timeLabel);
  lines.push("");

  for (const item of document.items) {
    const manualTag = item.isManualItem ? " (avulso)" : "";
    lines.push(`${item.quantity}x ${item.name}${manualTag}`);
    for (const note of item.notes) {
      lines.push(`   ${note}`);
    }
  }

  if (document.orderNotes) {
    lines.push("");
    lines.push("Observação:");
    lines.push(document.orderNotes);
  }

  lines.push("");
  lines.push(divider);

  return lines.join("\n");
}

export class MockPrintAdapter implements PrintAdapter {
  async print(jobId: string, document: PrintDocument, attemptCount: number): Promise<void> {
    if (process.env.FORKO_MOCK_FAIL === "true") {
      throw new Error("Falha simulada (FORKO_MOCK_FAIL=true).");
    }
    if (process.env.FORKO_MOCK_FAIL_ONCE === "true" && attemptCount <= 1) {
      throw new Error("Falha simulada — só na 1ª tentativa (FORKO_MOCK_FAIL_ONCE=true).");
    }

    await mkdir(PRINTS_DIR, { recursive: true });
    const filePath = path.join(PRINTS_DIR, `${jobId}.txt`);
    await writeFile(filePath, renderDocument(document), "utf8");
    console.log(`[mock] arquivo criado: ${filePath}`);
  }
}
