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
const { pathToFileURL } = require("node:url");

// Motor compilado, copiado pra dentro de `desktop/dist` pelo script
// `copy-engine.js` (rodado antes de `start`/`dist` — ver `package.json`)
// — nunca `../dist` direto, por causa de como o `electron-builder`
// empacota (só inclui de forma confiável o que está DENTRO da pasta do
// app).
const DIST = path.join(__dirname, "dist");

// Correção (2026-08-27) — pedido explícito: o restaurante não deve
// precisar digitar o endereço do FORKO (campo livre já causou risco de
// erro de digitação num teste real). ÚNICA fonte de verdade desse
// endereço em todo o app desktop — `forko:pair` usa isto internamente
// (nunca mais confia num valor vindo do formulário), e
// `forko:get-initial-state` devolve o mesmo valor pro renderer poder
// EXIBIR como informação, sem duplicar a string em outro arquivo.
const FORKO_OFFICIAL_URL = "https://mesaflow-seven.vercel.app";

let mainWindow = null;
let tray = null;
let agentHandle = null; // { stop() } de runAgentLoop, enquanto o loop estiver rodando
let quitting = false;
let engine = null;

async function loadEngine() {
  if (engine) return engine;
  // Correção (2026-08-27) — causa real do erro visto no teste em
  // Windows 7 x64 real (instalado no drive E:): `path.join(...)` gera
  // um caminho no formato do Windows (ex.: "E:\...\dist\config.js",
  // com "E:" no começo). `import()` dinâmico (ESM) — diferente do
  // `require()` do CommonJS — exige que um caminho ABSOLUTO chegue como
  // URL de verdade, não como string de caminho de sistema de arquivos
  // crua. Recebendo a string crua, o Node tenta interpretar "E:" como
  // se fosse um ESQUEMA de URL (igual "http:"/"file:") — daí
  // "UNSUPPORTED_ESM_URL_SCHEME", reportando o protocolo "e:". Isso só
  // aparecia em instalação fora do drive C: (por isso não pegamos antes
  // — testes anteriores devem ter sido em C:). `pathToFileURL(...).href`
  // converte o caminho pro formato de URL que o `import()` realmente
  // exige (`file:///E:/...`), corrigindo pra qualquer drive.
  const [config, agentRuntime, windowsTransport] = await Promise.all([
    import(pathToFileURL(path.join(DIST, "config.js")).href).then((m) => (m.default ? m.default : m)),
    import(pathToFileURL(path.join(DIST, "agent-runtime.js")).href).then((m) => (m.default ? m.default : m)),
    import(pathToFileURL(path.join(DIST, "transport", "windows-transport.js")).href).then((m) => (m.default ? m.default : m)),
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
  return { config, officialServerUrl: FORKO_OFFICIAL_URL };
});

ipcMain.handle("forko:pair", async (_event, { code, deviceName }) => {
  const eng = await loadEngine();
  // Sempre a URL oficial (constante única, acima) — nunca mais confia
  // num valor digitado pelo restaurante.
  const config = await eng.agentRuntime.pairAgent(FORKO_OFFICIAL_URL, code, deviceName);
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

  // Correção (2026-08-27) — pedido explícito: no Windows 7 real, botão
  // direito num campo de texto não mostrava opção de colar. API própria
  // do Electron pra isso: escuta o evento "context-menu" do
  // `webContents" e, quando o clique foi num elemento EDITÁVEL
  // (`params.isEditable`), mostra um menu de verdade com Recortar/
  // Copiar/Colar/Selecionar tudo — usando os `role`s nativos do
  // Electron (que já sabem interagir com a área de transferência do
  // SO), não reimplementando nada na mão. `params.editFlags` já vem
  // pronto do Chromium dizendo o que está disponível de verdade
  // naquele momento (ex.: "Colar" desabilitado se a área de
  // transferência estiver vazia).
  mainWindow.webContents.on("context-menu", (_event, params) => {
    if (!params.isEditable) return;
    Menu.buildFromTemplate([
      { role: "cut", enabled: params.editFlags.canCut },
      { role: "copy", enabled: params.editFlags.canCopy },
      { role: "paste", enabled: params.editFlags.canPaste },
      { type: "separator" },
      { role: "selectAll", enabled: params.editFlags.canSelectAll },
    ]).popup({ window: mainWindow });
  });

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

// Correção (2026-08-27) — reforço do mesmo pedido: menu de aplicação
// mínimo, só com "Editar" (roles nativos de novo — `cut`/`copy`/
// `paste`/`selectAll` já vêm com o atalho de teclado padrão do SO
// embutido, ex. Ctrl+V no Windows). Mesmo a barra de menu ficando
// invisível no Windows por padrão (só aparece com Alt), os atalhos de
// teclado continuam valendo — é o que garante Ctrl+C/V/X/A
// funcionarem de forma confiável, sem depender só do comportamento
// padrão de dentro da página.
function createApplicationMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Editar",
        submenu: [{ role: "cut" }, { role: "copy" }, { role: "paste" }, { type: "separator" }, { role: "selectAll" }],
      },
    ]),
  );
}

app.whenReady().then(async () => {
  createApplicationMenu();
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
