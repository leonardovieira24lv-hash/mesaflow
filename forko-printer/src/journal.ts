import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { JournalEntry } from "./types.js";

/**
 * FORKO Printer — Etapa 3A (2026-08-24). Journal persistente mínimo
 * pedido: jobId/status/printedAt. Regra central (pedido explícito): se
 * um job já está registrado como `printed` aqui, o `MockPrintAdapter`
 * NUNCA roda de novo pra ele — só reenvia o ACK. É a 1ª proteção contra
 * duplicidade depois de um crash/restart.
 *
 * Escrita atômica (pedido explícito, "evitar sobrescrever arquivo
 * parcialmente"): grava num arquivo temporário e só then troca de nome
 * (`rename`) pro arquivo final — um `rename` no mesmo sistema de
 * arquivos é atômico no SO; se o processo morrer no meio da escrita, o
 * arquivo temporário fica órfão, mas o `journal.json` real nunca fica
 * corrompido/parcial.
 */

export const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const JOURNAL_PATH = path.join(DATA_DIR, "journal.json");

async function readAllEntries(): Promise<JournalEntry[]> {
  try {
    const raw = await readFile(JOURNAL_PATH, "utf8");
    return JSON.parse(raw) as JournalEntry[];
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

async function writeAllEntries(entries: JournalEntry[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmpPath = `${JOURNAL_PATH}.tmp`;
  await writeFile(tmpPath, JSON.stringify(entries, null, 2), "utf8");
  await rename(tmpPath, JOURNAL_PATH);
}

export async function findEntry(jobId: string): Promise<JournalEntry | null> {
  const entries = await readAllEntries();
  return entries.find((e) => e.jobId === jobId) ?? null;
}

/** Registra a impressão mock — `ackStatus` sempre nasce `"pending"`
 *  (Etapa 3B): o ACK ainda não foi confirmado nesse exato instante, só
 *  DEPOIS de `markAckConfirmed()` é que vira `"confirmed"`. Essa janela
 *  entre as 2 chamadas é justamente o que permite provar o cenário de
 *  crash (`FORKO_MOCK_CRASH_AFTER_PRINT`) — se o processo morrer aqui no
 *  meio, o journal fica correto (`printed`/`pending`), só faltando reenviar
 *  o ACK, nunca reimprimir. */
export async function recordPrinted(jobId: string, orderLabel: string): Promise<void> {
  const entries = await readAllEntries();
  if (entries.some((e) => e.jobId === jobId)) return; // idempotente na escrita também.
  entries.push({ jobId, status: "printed", printedAt: new Date().toISOString(), ackStatus: "pending", orderLabel });
  await writeAllEntries(entries);
}

export async function markAckConfirmed(jobId: string): Promise<void> {
  const entries = await readAllEntries();
  const entry = entries.find((e) => e.jobId === jobId);
  if (!entry) return;
  entry.ackStatus = "confirmed";
  await writeAllEntries(entries);
}

/** Mais recentes primeiro — usado pelo comando `journal` (Etapa 3B). */
export async function listRecent(limit: number): Promise<JournalEntry[]> {
  const entries = await readAllEntries();
  return [...entries].reverse().slice(0, limit);
}

export async function countEntries(): Promise<number> {
  return (await readAllEntries()).length;
}

export async function getMostRecentEntry(): Promise<JournalEntry | null> {
  const entries = await readAllEntries();
  return entries.length > 0 ? entries[entries.length - 1]! : null;
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
