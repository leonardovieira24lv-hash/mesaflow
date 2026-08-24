import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { loadConfig, saveConfig, removeConfig, maskToken, CONFIG_PATH } from "./config.js";
import { pairDevice, claimJob, reportResult, UnauthorizedError } from "./api-client.js";
import { findEntry, recordPrinted, markAckConfirmed, listRecent, countEntries, getMostRecentEntry, DATA_DIR } from "./journal.js";
import { MockPrintAdapter } from "./adapters/mock-print-adapter.js";
import type { AgentConfig, ClaimedJob } from "./types.js";

/**
 * FORKO Printer — Etapa 3A/3B (2026-08-24). 5 comandos: `pair`, `start`,
 * `status`, `journal`, `reset`. Sem framework de CLI (pedido explícito)
 * — `process.argv` cru é suficiente pro que existe.
 */

const adapter = new MockPrintAdapter();

// ── pair ─────────────────────────────────────────────────────────────

async function commandPair(): Promise<void> {
  const existing = await loadConfig();
  if (existing) {
    // Etapa 3B: "se já existe config vinculada, não sobrescrever
    // silenciosamente" — exige confirmação explícita aqui em vez de
    // simplesmente parear de novo por cima.
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = await rl
      .question(
        `Já existe um dispositivo pareado (${existing.deviceName}, ${maskToken(existing.deviceToken)}).\n` +
          `Digite CONFIRMAR pra substituir, ou rode "npm run reset" primeiro: `,
      )
      .finally(() => rl.close());
    if (answer.trim().toUpperCase() !== "CONFIRMAR") {
      console.log("[printer] pareamento cancelado — configuração existente preservada.");
      return;
    }
  }

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const serverUrlRaw = await rl.question("URL do FORKO (ex.: https://mesaflow.vercel.app): ");
    const codeRaw = await rl.question("Código de vinculação: ");
    const deviceNameRaw = await rl.question("Nome deste dispositivo (ex.: FORKO Printer - Caixa): ");

    const serverUrl = serverUrlRaw.trim().replace(/\/+$/, "");
    const deviceName = deviceNameRaw.trim();

    if (!/^https?:\/\//i.test(serverUrl)) {
      console.log("[printer] URL inválida — precisa começar com http:// ou https://.");
      process.exitCode = 1;
      return;
    }
    if (!deviceName) {
      console.log("[printer] nome do dispositivo é obrigatório.");
      process.exitCode = 1;
      return;
    }

    console.log("[printer] pareando...");
    let deviceId: string;
    let deviceToken: string;
    try {
      ({ deviceId, deviceToken } = await pairDevice(serverUrl, codeRaw, deviceName));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`[printer] falha no pareamento: ${message}`);
      process.exitCode = 1;
      return;
    }

    const config: AgentConfig = { serverUrl, deviceId, deviceToken, deviceName };
    await saveConfig(config);

    console.log(`[printer] pareado com sucesso. Device ID: ${deviceId}`);
    console.log(`[printer] Token: ${maskToken(deviceToken)}`);
  } finally {
    rl.close();
  }
}

// ── status ───────────────────────────────────────────────────────────

async function commandStatus(): Promise<void> {
  const config = await loadConfig();
  const total = await countEntries();
  const last = await getMostRecentEntry();

  console.log("FORKO Printer");
  console.log("");
  console.log("Servidor:");
  console.log(config?.serverUrl ?? "(não configurado)");
  console.log("");
  console.log("Dispositivo:");
  console.log(config?.deviceName ?? "(não configurado)");
  console.log("");
  console.log("Device ID:");
  console.log(config?.deviceId ?? "(não configurado)");
  console.log("");
  console.log("Vinculado:");
  console.log(config ? "SIM" : "NÃO");
  console.log("");
  console.log("Token configurado:");
  console.log(config ? `SIM (${maskToken(config.deviceToken)})` : "NÃO");
  console.log("");
  console.log("Journal:");
  console.log(`${total} job${total === 1 ? "" : "s"} registrado${total === 1 ? "" : "s"}`);
  console.log("");
  console.log("Último job:");
  console.log(last ? `${last.orderLabel} — ${last.printedAt} (ACK: ${last.ackStatus})` : "(nenhum)");
}

// ── journal ──────────────────────────────────────────────────────────

async function commandJournal(): Promise<void> {
  const entries = await listRecent(20);
  if (entries.length === 0) {
    console.log("[journal] nenhum registro ainda.");
    return;
  }
  console.log(`[journal] últimos ${entries.length} registro(s):`);
  for (const entry of entries) {
    console.log(`  ${entry.jobId}  ${entry.status}  ackStatus=${entry.ackStatus}  ${entry.printedAt}  ${entry.orderLabel}`);
  }
}

// ── reset ────────────────────────────────────────────────────────────

async function commandReset(all: boolean): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });
  const question = all
    ? "Isso vai apagar o VÍNCULO e o JOURNAL/prints mock locais. Digite CONFIRMAR pra continuar: "
    : "Isso vai apagar o vínculo local (o journal é preservado). Digite CONFIRMAR pra continuar: ";
  const answer = await rl.question(question).finally(() => rl.close());

  if (answer.trim().toUpperCase() !== "CONFIRMAR") {
    console.log("[printer] reset cancelado.");
    return;
  }

  await removeConfig();
  console.log(`[printer] vínculo removido (${path.basename(CONFIG_PATH)}).`);

  if (all) {
    await rm(DATA_DIR, { recursive: true, force: true });
    console.log("[printer] journal e prints mock removidos.");
  }
}

// ── start ────────────────────────────────────────────────────────────

const POLL_BACKOFF_STEPS_MS = [3_000, 5_000, 10_000, 15_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processJob(config: AgentConfig, job: ClaimedJob): Promise<void> {
  const existing = await findEntry(job.id);

  if (existing) {
    console.log(`[journal] job ${job.id} já registrado como impresso — reenviando ACK`);
    await reportResult(config, job.id, { status: "printed" });
    await markAckConfirmed(job.id);
    console.log(`[network] ACK confirmado para job ${job.id}`);
    return;
  }

  console.log(`[printer] job ${job.id} recebido (${job.document.header.orderLabel})`);

  try {
    await adapter.print(job.id, job.document, job.attemptCount);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`[printer] falha ao imprimir job ${job.id}: ${message}`);
    await reportResult(config, job.id, {
      status: "failed",
      retryable: true,
      errorCode: "mock_failure",
      errorMessage: message,
    });
    return;
  }

  await recordPrinted(job.id, job.document.header.orderLabel);
  console.log(`[journal] printed registrado para job ${job.id} (ackStatus=pending)`);

  if (process.env.FORKO_MOCK_CRASH_AFTER_PRINT === "true") {
    console.log("[printer] FORKO_MOCK_CRASH_AFTER_PRINT=true — encerrando ANTES do ACK, de propósito.");
    process.exit(1);
  }

  await reportResult(config, job.id, { status: "printed" });
  await markAckConfirmed(job.id);
  console.log(`[network] ACK confirmado para job ${job.id}`);
}

async function commandStart(): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    console.log("[printer] nenhum dispositivo pareado. Rode `npm run pair` primeiro.");
    process.exitCode = 1;
    return;
  }

  console.log(`[printer] iniciado — ${config.deviceName} (${config.serverUrl})`);

  let stopping = false;
  let backoffIndex = 0;

  const stop = () => {
    if (stopping) return;
    stopping = true;
    console.log("[printer] encerrando...");
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  while (!stopping) {
    try {
      const job = await claimJob(config);
      backoffIndex = 0;

      if (!job) {
        await sleep(POLL_BACKOFF_STEPS_MS[0]!);
        continue;
      }

      await processJob(config, job);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        console.log("[printer] Dispositivo não autorizado. Faça o pareamento novamente.");
        process.exitCode = 1;
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      const waitMs = POLL_BACKOFF_STEPS_MS[Math.min(backoffIndex, POLL_BACKOFF_STEPS_MS.length - 1)]!;
      console.log(`[network] conexão indisponível (${message}) — tentando em ${waitMs / 1000}s`);
      backoffIndex = Math.min(backoffIndex + 1, POLL_BACKOFF_STEPS_MS.length - 1);
      await sleep(waitMs);
    }
  }
}

// ── entrada ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case "pair":
      await commandPair();
      break;
    case "start":
      await commandStart();
      break;
    case "status":
      await commandStatus();
      break;
    case "journal":
      await commandJournal();
      break;
    case "reset":
      await commandReset(rest.includes("--all"));
      break;
    default:
      console.log("Uso: node dist/index.js <pair|start|status|journal|reset> [--all]");
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[printer] erro fatal:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
