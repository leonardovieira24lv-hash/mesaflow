import { readFile, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { AgentConfig } from "./types.js";

/**
 * FORKO Printer — Etapa 3A (2026-08-24). Persistência local mínima
 * pedida: `serverUrl`/`deviceId`/`deviceToken`/`deviceName`, num arquivo
 * (`config.json`, já no `.gitignore` — nunca commitado). Sem
 * criptografia adicional nesta fase mock (pedido explícito: "o token
 * pode ficar em arquivo local nesta fase mock").
 */

export const CONFIG_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "config.json");

export async function loadConfig(): Promise<AgentConfig | null> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    return JSON.parse(raw) as AgentConfig;
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

export async function saveConfig(config: AgentConfig): Promise<void> {
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}

/** Etapa 3B — usado pelo comando `reset` (sempre) e implicitamente
 *  substituído por um `saveConfig()` novo quando o `pair` é refeito
 *  depois de um reset explícito. */
export async function removeConfig(): Promise<void> {
  await rm(CONFIG_PATH, { force: true });
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

/** Nunca logar o token inteiro — só os últimos 4 caracteres, o
 *  suficiente pra reconhecer visualmente qual token é sem expor o
 *  segredo (pedido explícito: "nunca imprimir o token completo nos
 *  logs"). Reaproveitada pelo `index.ts` no comando `pair`. */
export function maskToken(token: string): string {
  return `${token.slice(0, "forko_printer_".length)}****${token.slice(-4)}`;
}
