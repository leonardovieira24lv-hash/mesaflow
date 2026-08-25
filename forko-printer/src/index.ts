import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { loadConfig, removeConfig, maskToken, CONFIG_PATH } from "./config.js";
import { listRecent, countEntries, getMostRecentEntry, DATA_DIR } from "./journal.js";
import { pairAgent, runAgentLoop, resolvePrintAdapter } from "./agent-runtime.js";
import { listWindowsPrinters } from "./transport/windows-transport.js";
import type { PrintAdapter } from "./adapters/print-adapter.js";
import type { AgentConfig, PrintDocument } from "./types.js";

/**
 * FORKO Printer — Etapa 3A/3B/5B/6 (2026-08-25). 7 comandos: `pair`,
 * `start`, `status`, `journal`, `reset`, `test-print`, `printers`. Sem
 * framework de CLI (pedido explícito) — `process.argv` cru é suficiente
 * pro que existe. A partir da Etapa 6, o pareamento e o loop de
 * claim/print/journal/ACK+heartbeat moraram pra `agent-runtime.ts` —
 * reutilizados também pela UI desktop (Electron), sem duplicar regra
 * nenhuma entre os dois.
 */

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
    let config: AgentConfig;
    try {
      config = await pairAgent(serverUrl, codeRaw, deviceName);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`[printer] falha no pareamento: ${message}`);
      process.exitCode = 1;
      return;
    }

    console.log(`[printer] pareado com sucesso. Device ID: ${config.deviceId}`);
    console.log(`[printer] Token: ${maskToken(config.deviceToken)}`);
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

async function commandStart(): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    console.log("[printer] nenhum dispositivo pareado. Rode `npm run pair` primeiro.");
    process.exitCode = 1;
    return;
  }

  // Etapa 5B — pedido explícito: "config TCP inválida, agent NÃO deve
  // iniciar impressão silenciosamente". Resolvido AQUI, antes do loop
  // começar.
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

  // Etapa 6 — o loop em si (claim→print→journal→ACK + heartbeat) mora
  // em `agent-runtime.ts` agora, reutilizado também pela UI desktop.
  // Este comando só decide COMO reportar (`console.log`) e QUANDO parar
  // (SIGINT/SIGTERM) — nenhuma regra de negócio muda aqui.
  await new Promise<void>((resolve) => {
    const handle = runAgentLoop(config, adapter, {
      onLog: (line) => console.log(line),
      onUnauthorized: () => {
        process.exitCode = 1;
        resolve();
      },
    });

    const stop = () => {
      console.log("[printer] encerrando...");
      handle.stop();
      resolve();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
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
