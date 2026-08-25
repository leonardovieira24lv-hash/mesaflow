import { saveConfig } from "./config.js";
import { pairDevice, claimJob, reportResult, sendHeartbeat, UnauthorizedError } from "./api-client.js";
import { findEntry, recordPrinted, markAckConfirmed } from "./journal.js";
import { MockPrintAdapter } from "./adapters/mock-print-adapter.js";
import { TcpPrintAdapter } from "./adapters/tcp-print-adapter.js";
import { WindowsPrintAdapter } from "./adapters/windows-print-adapter.js";
import { PrintAdapterError } from "./types.js";
import type { AgentConfig, ClaimedJob, TcpPrinterConfig, WindowsPrinterConfig } from "./types.js";
import type { PrintAdapter } from "./adapters/print-adapter.js";

/**
 * FORKO Printer — Etapa 6 (2026-08-25). Extração MÍNIMA pedida
 * explicitamente: a lógica de pareamento e o loop de
 * claim→print→journal→ACK+heartbeat estavam presos dentro de
 * `commandPair`/`commandStart`/`processJob` em `index.ts`, amarrados a
 * `readline`/`console.log`/`process.argv` — coisas que só fazem sentido
 * num terminal. A UI desktop (Electron) precisa da MESMA lógica, sem
 * terminal nenhum.
 *
 * Nenhuma regra mudou — só o "onde mora" e como ela reporta progresso
 * (via callbacks, em vez de `console.log` direto). `index.ts` (CLI)
 * passa `onLog: console.log`; a UI desktop passa uma função que
 * atualiza a tela. A regra de negócio em si (idempotência do journal,
 * backoff, autorização) é literalmente o mesmo código de antes, só
 * movido pra cá.
 */

export interface AgentRuntimeCallbacks {
  onLog: (line: string) => void;
  onUnauthorized: () => void;
  onJobPrinted?: (job: ClaimedJob) => void;
  onJobFailed?: (job: ClaimedJob, message: string) => void;
}

export async function pairAgent(serverUrl: string, code: string, deviceName: string): Promise<AgentConfig> {
  const normalizedServerUrl = serverUrl.trim().replace(/\/+$/, "");
  const normalizedDeviceName = deviceName.trim();

  const { deviceId, deviceToken } = await pairDevice(normalizedServerUrl, code, normalizedDeviceName);

  const config: AgentConfig = {
    serverUrl: normalizedServerUrl,
    deviceId,
    deviceToken,
    deviceName: normalizedDeviceName,
  };
  await saveConfig(config);
  return config;
}

/**
 * Movida de `index.ts` na Etapa 6 — pelo mesmo motivo do resto deste
 * arquivo: CLI e UI desktop precisam da MESMA regra de "qual adapter
 * usar conforme a config", nunca duas implementações da mesma escolha.
 * Ausência de `config.adapter` → `"mock"`, comportamento preservado
 * desde a Etapa 3A (configs antigas nunca quebram).
 */
export function resolvePrintAdapter(config: AgentConfig): PrintAdapter {
  const kind = config.adapter ?? "mock";

  if (kind === "mock") {
    return new MockPrintAdapter();
  }

  if (kind === "tcp") {
    const printer = config.printer as TcpPrinterConfig | undefined;
    if (!printer?.host) {
      throw new Error('Configuração de impressora TCP inválida: "printer.host" é obrigatório.');
    }
    return new TcpPrintAdapter({
      host: printer.host,
      port: printer.port ?? 9100,
      paperWidth: printer.paperWidth ?? 80,
      hasCutter: printer.hasCutter ?? false,
    });
  }

  if (kind === "windows") {
    const printer = config.printer as WindowsPrinterConfig | undefined;
    if (!printer?.name) {
      throw new Error('Configuração de impressora Windows inválida: "printer.name" é obrigatório.');
    }
    return new WindowsPrintAdapter({
      printerName: printer.name,
      paperWidth: printer.paperWidth ?? 80,
      hasCutter: printer.hasCutter ?? false,
    });
  }

  throw new Error(`Adapter de impressão desconhecido: "${kind}".`);
}

const POLL_BACKOFF_STEPS_MS = [3_000, 5_000, 10_000, 15_000];
const HEARTBEAT_INTERVAL_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processJob(
  config: AgentConfig,
  adapter: PrintAdapter,
  job: ClaimedJob,
  callbacks: AgentRuntimeCallbacks,
): Promise<void> {
  const existing = await findEntry(job.id);

  if (existing) {
    callbacks.onLog(`[journal] job ${job.id} já registrado como impresso — reenviando ACK`);
    await reportResult(config, job.id, { status: "printed" });
    await markAckConfirmed(job.id);
    callbacks.onLog(`[network] ACK confirmado para job ${job.id}`);
    callbacks.onJobPrinted?.(job);
    return;
  }

  callbacks.onLog(`[printer] job ${job.id} recebido (${job.document.header.orderLabel})`);

  try {
    await adapter.print(job.id, job.document, job.attemptCount);
  } catch (err) {
    const isAdapterError = err instanceof PrintAdapterError;
    const errorCode = isAdapterError ? err.code : "unknown_print_error";
    const retryable = isAdapterError ? err.retryable : true;
    const message = err instanceof Error ? err.message : String(err);

    callbacks.onLog(`[printer] falha ao imprimir job ${job.id}: ${message}`);
    await reportResult(config, job.id, { status: "failed", retryable, errorCode, errorMessage: message });
    callbacks.onJobFailed?.(job, message);
    return;
  }

  await recordPrinted(job.id, job.document.header.orderLabel);
  callbacks.onLog(`[journal] printed registrado para job ${job.id} (ackStatus=pending)`);

  if (process.env.FORKO_MOCK_CRASH_AFTER_PRINT === "true") {
    callbacks.onLog("[printer] FORKO_MOCK_CRASH_AFTER_PRINT=true — encerrando ANTES do ACK, de propósito.");
    process.exit(1);
  }

  await reportResult(config, job.id, { status: "printed" });
  await markAckConfirmed(job.id);
  callbacks.onLog(`[network] ACK confirmado para job ${job.id}`);
  callbacks.onJobPrinted?.(job);
}

export interface AgentLoopHandle {
  stop(): void;
}

export function runAgentLoop(config: AgentConfig, adapter: PrintAdapter, callbacks: AgentRuntimeCallbacks): AgentLoopHandle {
  let stopping = false;
  let backoffIndex = 0;

  const heartbeatTimer = setInterval(() => {
    void sendHeartbeat(config).catch((err) => {
      if (err instanceof UnauthorizedError) {
        callbacks.onLog("[printer] Dispositivo não autorizado. Faça o pareamento novamente.");
        callbacks.onUnauthorized();
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      callbacks.onLog(`[network] heartbeat falhou (${message}) — próxima tentativa em ${HEARTBEAT_INTERVAL_MS / 1000}s`);
    });
  }, HEARTBEAT_INTERVAL_MS);

  void (async () => {
    while (!stopping) {
      try {
        const job = await claimJob(config);
        backoffIndex = 0;

        if (!job) {
          await sleep(POLL_BACKOFF_STEPS_MS[0]!);
          continue;
        }

        await processJob(config, adapter, job, callbacks);
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          callbacks.onLog("[printer] Dispositivo não autorizado. Faça o pareamento novamente.");
          clearInterval(heartbeatTimer);
          callbacks.onUnauthorized();
          return;
        }

        const message = err instanceof Error ? err.message : String(err);
        const waitMs = POLL_BACKOFF_STEPS_MS[Math.min(backoffIndex, POLL_BACKOFF_STEPS_MS.length - 1)]!;
        callbacks.onLog(`[network] conexão indisponível (${message}) — tentando em ${waitMs / 1000}s`);
        backoffIndex = Math.min(backoffIndex + 1, POLL_BACKOFF_STEPS_MS.length - 1);
        await sleep(waitMs);
      }
    }
    clearInterval(heartbeatTimer);
  })();

  return {
    stop() {
      stopping = true;
      clearInterval(heartbeatTimer);
    },
  };
}
