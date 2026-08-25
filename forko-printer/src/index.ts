import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { loadConfig, saveConfig, removeConfig, maskToken, CONFIG_PATH } from "./config.js";
import { pairDevice, claimJob, reportResult, sendHeartbeat, UnauthorizedError } from "./api-client.js";
import { findEntry, recordPrinted, markAckConfirmed, listRecent, countEntries, getMostRecentEntry, DATA_DIR } from "./journal.js";
import { MockPrintAdapter } from "./adapters/mock-print-adapter.js";
import { TcpPrintAdapter } from "./adapters/tcp-print-adapter.js";
import { WindowsPrintAdapter } from "./adapters/windows-print-adapter.js";
import { listWindowsPrinters } from "./transport/windows-transport.js";
import type { PrintAdapter } from "./adapters/print-adapter.js";
import { PrintAdapterError } from "./types.js";
import type { AgentConfig, ClaimedJob, PrintDocument, TcpPrinterConfig, WindowsPrinterConfig } from "./types.js";

/**
 * FORKO Printer — Etapa 3A/3B/5B (2026-08-24). 6 comandos: `pair`,
 * `start`, `status`, `journal`, `reset`, `test-print`. Sem framework de
 * CLI (pedido explícito) — `process.argv` cru é suficiente pro que
 * existe.
 */

/**
 * Etapa 5B — substitui a antiga `const adapter = new MockPrintAdapter()`
 * (constante fixa de módulo). Agora depende da config carregada em
 * runtime, então vira uma função resolvida uma vez por comando
 * (`commandStart`/`commandTestPrint`), não mais um valor fixo no
 * carregamento do arquivo.
 *
 * Compatibilidade (pedido explícito, "configs antigas não podem
 * quebrar"): `config.adapter` ausente → `"mock"`, comportamento
 * idêntico ao de antes desta etapa, sem exceção.
 */
function resolvePrintAdapter(config: AgentConfig): PrintAdapter {
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

async function processJob(config: AgentConfig, adapter: PrintAdapter, job: ClaimedJob): Promise<void> {
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
    // Etapa 5B — corrigido: antes disto `errorCode` era sempre
    // `"mock_failure"`, fixo, não importava qual adapter falhasse
    // (achado na auditoria desta etapa). Agora lê `code`/`retryable`
    // reais quando o adapter lança `PrintAdapterError` (mock e tcp já
    // fazem isso) — só cai num fallback genérico se o adapter lançar um
    // `Error` comum (não deveria acontecer com os 2 adapters atuais,
    // mas cobre qualquer futuro adapter que ainda não tenha sido
    // atualizado pra usar o tipo certo).
    const isAdapterError = err instanceof PrintAdapterError;
    const errorCode = isAdapterError ? err.code : "unknown_print_error";
    const retryable = isAdapterError ? err.retryable : true;
    const message = err instanceof Error ? err.message : String(err);

    console.log(`[printer] falha ao imprimir job ${job.id}: ${message}`);
    await reportResult(config, job.id, { status: "failed", retryable, errorCode, errorMessage: message });
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

  // Etapa 5B — pedido explícito: "config TCP inválida, agent NÃO deve
  // iniciar impressão silenciosamente". Resolvido AQUI, antes do loop
  // começar — se `adapter: "tcp"` estiver configurado sem `printer.host`,
  // por exemplo, o agente para com uma mensagem clara em vez de só
  // falhar (ou pior, cair silenciosamente pro mock) na primeira tentativa
  // de imprimir.
  let adapter: PrintAdapter;
  try {
    adapter = resolvePrintAdapter(config);
  } catch (err) {
    console.log(`[printer] configuração de impressão inválida: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
    return;
  }

  console.log(`[printer] iniciado — ${config.deviceName} (${config.serverUrl})`);
  console.log(`[printer] adapter de impressão: ${config.adapter ?? "mock"}`);

  let stopping = false;
  let backoffIndex = 0;

  const stop = () => {
    if (stopping) return;
    stopping = true;
    console.log("[printer] encerrando...");
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  // Heartbeat (Etapa 4) — timer PRÓPRIO, independente do loop principal
  // de jobs (pedido explícito: "heartbeat NÃO pode iniciar segundo loop
  // de jobs" — este `setInterval` nunca chama `claimJob`/`processJob`,
  // só `sendHeartbeat`). Uma falha aqui NUNCA derruba um job em
  // processamento — `try/catch` próprio, log e segue, exceto 401/403,
  // que segue a MESMA política de "dispositivo não autorizado" do loop
  // principal (reaproveita o mesmo `stop()`).
  const HEARTBEAT_INTERVAL_MS = 30_000;
  const heartbeatTimer = setInterval(() => {
    void sendHeartbeat(config).catch((err) => {
      if (err instanceof UnauthorizedError) {
        console.log("[printer] Dispositivo não autorizado. Faça o pareamento novamente.");
        stop();
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      console.log(`[network] heartbeat falhou (${message}) — próxima tentativa em ${HEARTBEAT_INTERVAL_MS / 1000}s`);
    });
  }, HEARTBEAT_INTERVAL_MS);

  while (!stopping) {
    try {
      const job = await claimJob(config);
      backoffIndex = 0;

      if (!job) {
        await sleep(POLL_BACKOFF_STEPS_MS[0]!);
        continue;
      }

      await processJob(config, adapter, job);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        console.log("[printer] Dispositivo não autorizado. Faça o pareamento novamente.");
        clearInterval(heartbeatTimer);
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

  clearInterval(heartbeatTimer);
}

// ── test-print ───────────────────────────────────────────────────────

/**
 * Etapa 5B — pedido explícito: prova a impressora física de ponta a
 * ponta (mesmos `ReceiptFormatter`/`EscPosRenderer`/`TcpTransport` do
 * fluxo real) SEM precisar de um pedido de verdade nem passar pelo
 * servidor do FORKO — nenhum HTTP local, nenhum `print_jobs` envolvido.
 * Só faz sentido com `adapter: "tcp"` configurado (mock não tem nada
 * físico pra testar).
 */
async function commandTestPrint(): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    console.log("[printer] nenhum dispositivo pareado. Rode `npm run pair` primeiro.");
    process.exitCode = 1;
    return;
  }

  if ((config.adapter ?? "mock") === "mock") {
    console.log('[printer] "npm run test-print" exige "adapter": "tcp" ou "windows" configurado em config.json.');
    process.exitCode = 1;
    return;
  }

  let adapter: PrintAdapter;
  try {
    adapter = resolvePrintAdapter(config);
  } catch (err) {
    console.log(`[printer] configuração de impressão inválida: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
    return;
  }

  const testDocument: PrintDocument = {
    header: {
      restaurantName: "FORKO PRINTER",
      orderLabel: "TESTE DE IMPRESSÃO",
      tableLabel: "Mesa 01",
      timeLabel: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    },
    items: [{ quantity: 2, name: "Produto teste", isManualItem: false, notes: ["Adicional: Bacon"] }],
    orderNotes: "Sem cebola\n\nÁÉÍÓÚ Ç Ã Õ",
  };

  console.log("[printer] enviando teste de impressão...");
  try {
    await adapter.print("test-print", testDocument, 1);
    console.log("[printer] teste de impressão enviado com sucesso.");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`[printer] falha no teste de impressão: ${message}`);
    process.exitCode = 1;
  }
}

// ── printers ─────────────────────────────────────────────────────────

/**
 * Etapa 5C — lista impressoras instaladas no Windows, pra facilitar
 * preencher `printer.name` na config. Em qualquer outro SO, mensagem
 * clara e sai — nunca tenta rodar PowerShell fora do Windows, nunca
 * quebra o build/comandos em Linux/Mac (pedido explícito).
 */
async function commandPrinters(): Promise<void> {
  if (process.platform !== "win32") {
    console.log("Este comando está disponível apenas no Windows.");
    return;
  }

  console.log("[printer] consultando impressoras instaladas...");
  try {
    const printers = await listWindowsPrinters();
    if (printers.length === 0) {
      console.log("Nenhuma impressora instalada encontrada.");
      return;
    }
    console.log("");
    console.log("Impressoras instaladas:");
    console.log("");
    printers.forEach((printer, index) => {
      const defaultTag = printer.isDefault ? " (padrão)" : "";
      console.log(`  ${index + 1}. ${printer.name}${defaultTag}`);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`[printer] falha ao consultar impressoras: ${message}`);
    process.exitCode = 1;
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
    case "test-print":
      await commandTestPrint();
      break;
    case "printers":
      await commandPrinters();
      break;
    default:
      console.log("Uso: node dist/index.js <pair|start|status|journal|reset|test-print|printers> [--all]");
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[printer] erro fatal:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
