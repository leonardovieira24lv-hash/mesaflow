// FORKO Printer Desktop — Etapa 6 (2026-08-25).
//
// Processo PRINCIPAL do Electron. Não reimplementa nenhuma regra —
// importa (via `import()` dinâmico) os módulos JÁ COMPILADOS do motor
// existente (`../dist/*.js`, o mesmo `tsc` da CLI) e só orquestra:
// mostra janela, fala com o motor, empurra atualizações pra tela.
//
// CommonJS de propósito (`require`), não ESM — o motor É ESM
// (`"type": "module"` em `forko-printer/package.json`), mas o processo
// principal do Electron aqui roda CJS puro; a ponte é `import()`
// dinâmico, que funciona em CJS desde o Node 12+, sem precisar mudar o
// tipo de módulo do app inteiro nem duplicar nada em CJS.

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require("electron");
const path = require("node:path");

// Motor compilado, copiado pra dentro de `desktop/dist` pelo script
// `copy-engine.js` (rodado antes de `start`/`dist` — ver `package.json`)
// — nunca `../dist` direto, por causa de como o `electron-builder`
// empacota (só inclui de forma confiável o que está DENTRO da pasta do
// app).
const DIST = path.join(__dirname, "dist");

let mainWindow = null;
let tray = null;
let agentHandle = null; // { stop() } de runAgentLoop, enquanto o loop estiver rodando
let quitting = false;
let engine = null;

async function loadEngine() {
  if (engine) return engine;
  const [config, agentRuntime, windowsTransport] = await Promise.all([
    import(path.join(DIST, "config.js")).then((m) => (m.default ? m.default : m)),
    import(path.join(DIST, "agent-runtime.js")).then((m) => (m.default ? m.default : m)),
    import(path.join(DIST, "transport", "windows-transport.js")).then((m) => (m.default ? m.default : m)),
  ]);
  engine = { config, agentRuntime, windowsTransport };
  return engine;
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function appendLog(line) {
  sendToRenderer("forko:log", line);
}

async function restartAgentLoop() {
  const eng = await loadEngine();
  if (agentHandle) {
    agentHandle.stop();
    agentHandle = null;
  }

  const config = await eng.config.loadConfig();
  if (!config) return;

  if (!config.adapter || config.adapter === "mock") {
    sendToRenderer("forko:status", { state: "needs-printer", config });
    return;
  }

  let adapter;
  try {
    adapter = eng.agentRuntime.resolvePrintAdapter(config);
  } catch (err) {
    sendToRenderer("forko:status", { state: "printer-error", config, error: err.message });
    return;
  }

  sendToRenderer("forko:status", { state: "running", config });
  appendLog(`[printer] iniciado — ${config.deviceName} (${config.serverUrl})`);
  appendLog(`[printer] adapter de impressão: ${config.adapter}`);

  agentHandle = eng.agentRuntime.runAgentLoop(config, adapter, {
    onLog: appendLog,
    onUnauthorized: () => {
      sendToRenderer("forko:status", { state: "unauthorized" });
    },
    onJobPrinted: (job) => sendToRenderer("forko:job-printed", { orderLabel: job.document.header.orderLabel }),
    onJobFailed: (job, message) => sendToRenderer("forko:job-failed", { orderLabel: job.document.header.orderLabel, message }),
  });
}

ipcMain.handle("forko:get-initial-state", async () => {
  const eng = await loadEngine();
  const config = await eng.config.loadConfig();
  return { config };
});

ipcMain.handle("forko:pair", async (_event, { serverUrl, code, deviceName }) => {
  const eng = await loadEngine();
  const config = await eng.agentRuntime.pairAgent(serverUrl, code, deviceName);
  return { config };
});

ipcMain.handle("forko:list-printers", async () => {
  const eng = await loadEngine();
  return eng.windowsTransport.listWindowsPrinters();
});

ipcMain.handle("forko:save-printer-settings", async (_event, { printerName, paperWidth, hasCutter }) => {
  const eng = await loadEngine();
  const config = await eng.config.loadConfig();
  if (!config) throw new Error("Nenhum dispositivo pareado.");

  const updated = {
    ...config,
    adapter: "windows",
    printer: { name: printerName, paperWidth, hasCutter },
  };
  await eng.config.saveConfig(updated);
  await restartAgentLoop();
  return { config: updated };
});

ipcMain.handle("forko:test-print", async () => {
  const eng = await loadEngine();
  const config = await eng.config.loadConfig();
  if (!config) throw new Error("Nenhum dispositivo pareado.");

  const adapter = eng.agentRuntime.resolvePrintAdapter(config);

  const testDocument = {
    header: {
      restaurantName: "FORKO PRINTER",
      orderLabel: "TESTE DE IMPRESSÃO",
      tableLabel: "Mesa 01",
      timeLabel: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    },
    items: [{ quantity: 2, name: "Produto teste", isManualItem: false, notes: ["Adicional: Bacon"] }],
    orderNotes: "Sem cebola\n\nÁÉÍÓÚ Ç Ã Õ",
  };

  await adapter.print("test-print", testDocument, 1);
  return { ok: true };
});

ipcMain.handle("forko:reset", async () => {
  const eng = await loadEngine();
  if (agentHandle) {
    agentHandle.stop();
    agentHandle = null;
  }
  await eng.config.removeConfig();
});

ipcMain.handle("forko:quit", () => {
  quitting = true;
  app.quit();
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 640,
    resizable: false,
    icon: path.join(__dirname, "assets", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, "assets", "icon.ico"));
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip("FORKO Printer");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Abrir FORKO Printer", click: () => mainWindow?.show() },
      { type: "separator" },
      {
        label: "Sair",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", () => mainWindow?.show());
}

app.whenReady().then(async () => {
  createWindow();
  createTray();
  await restartAgentLoop();
});

app.on("window-all-closed", () => {
  // Nunca encerra por fechar a janela — só "Sair" de verdade encerra
  // (pedido explícito).
});

app.on("before-quit", () => {
  quitting = true;
  if (agentHandle) {
    agentHandle.stop();
    agentHandle = null;
  }
});
