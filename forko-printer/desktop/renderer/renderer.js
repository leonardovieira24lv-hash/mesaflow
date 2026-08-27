// FORKO Printer Desktop — Etapa 6 (2026-08-25).
// Este arquivo só manipula a TELA — toda regra de verdade (pareamento,
// impressão, journal, retry) mora no motor (`main.js` → `agent-runtime.ts`
// compilado). O renderer nunca fala com o motor direto, só via
// `window.forko` (exposto pelo `preload.js`).

const screenUnpaired = document.getElementById("screen-unpaired");
const screenPaired = document.getElementById("screen-paired");

const officialServerUrlLabel = document.getElementById("official-server-url");
const inputCode = document.getElementById("input-code");
const inputDeviceName = document.getElementById("input-device-name");
const btnConnect = document.getElementById("btn-connect");
const unpairedError = document.getElementById("unpaired-error");

const statusDot = document.getElementById("status-dot");
const statusLabel = document.getElementById("status-label");
const deviceNameLabel = document.getElementById("device-name");
const selectPrinter = document.getElementById("select-printer");
const checkboxCutter = document.getElementById("checkbox-cutter");
const btnSaveSettings = document.getElementById("btn-save-settings");
const btnTestPrint = document.getElementById("btn-test-print");
const pairedMessage = document.getElementById("paired-message");
const logList = document.getElementById("log-list");
const btnQuit = document.getElementById("btn-quit");

function showUnpaired() {
  screenUnpaired.classList.remove("hidden");
  screenPaired.classList.add("hidden");
}

function showPaired(config) {
  screenUnpaired.classList.add("hidden");
  screenPaired.classList.remove("hidden");
  deviceNameLabel.textContent = config?.deviceName ?? "";

  if (config?.printer?.paperWidth) {
    const radio = document.querySelector(`input[name="paper-width"][value="${config.printer.paperWidth}"]`);
    if (radio) radio.checked = true;
  }
  checkboxCutter.checked = Boolean(config?.printer?.hasCutter);
}

function appendLogLine(line) {
  const el = document.createElement("div");
  el.textContent = line;
  logList.prepend(el);
  while (logList.children.length > 100) logList.removeChild(logList.lastChild);
}

async function loadPrinters(selectedName) {
  selectPrinter.innerHTML = "";
  try {
    const printers = await window.forko.listPrinters();
    if (printers.length === 0) {
      selectPrinter.innerHTML = '<option value="">Nenhuma impressora encontrada</option>';
      return;
    }
    for (const printer of printers) {
      const option = document.createElement("option");
      option.value = printer.name;
      option.textContent = printer.name + (printer.isDefault ? " (padrão)" : "");
      if (printer.name === selectedName) option.selected = true;
      selectPrinter.appendChild(option);
    }
  } catch (err) {
    selectPrinter.innerHTML = `<option value="">Não foi possível listar (${err.message})</option>`;
  }
}

btnConnect.addEventListener("click", async () => {
  unpairedError.textContent = "";
  btnConnect.disabled = true;
  btnConnect.textContent = "Conectando...";
  try {
    const { config } = await window.forko.pair({
      code: inputCode.value,
      deviceName: inputDeviceName.value,
    });
    showPaired(config);
    await loadPrinters();
  } catch (err) {
    unpairedError.textContent = err.message || "Não foi possível conectar.";
  } finally {
    btnConnect.disabled = false;
    btnConnect.textContent = "Conectar";
  }
});

btnSaveSettings.addEventListener("click", async () => {
  pairedMessage.textContent = "Salvando...";
  try {
    const paperWidth = Number(document.querySelector('input[name="paper-width"]:checked').value);
    const { config } = await window.forko.savePrinterSettings({
      printerName: selectPrinter.value,
      paperWidth,
      hasCutter: checkboxCutter.checked,
    });
    pairedMessage.textContent = "Configuração salva.";
    showPaired(config);
  } catch (err) {
    pairedMessage.textContent = err.message || "Não foi possível salvar.";
  }
});

btnTestPrint.addEventListener("click", async () => {
  pairedMessage.textContent = "Enviando teste...";
  btnTestPrint.disabled = true;
  try {
    await window.forko.testPrint();
    pairedMessage.textContent = "Teste enviado com sucesso.";
  } catch (err) {
    pairedMessage.textContent = `Falha no teste: ${err.message}`;
  } finally {
    btnTestPrint.disabled = false;
  }
});

btnQuit.addEventListener("click", () => {
  window.forko.quit();
});

window.forko.onLog((line) => appendLogLine(line));

window.forko.onStatus((status) => {
  if (status.state === "running") {
    statusDot.className = "status-dot online";
    statusLabel.textContent = "Online";
  } else if (status.state === "needs-printer") {
    statusDot.className = "status-dot";
    statusLabel.textContent = "Escolha uma impressora";
  } else if (status.state === "printer-error") {
    statusDot.className = "status-dot error";
    statusLabel.textContent = "Configuração inválida";
    pairedMessage.textContent = status.error ?? "";
  } else if (status.state === "unauthorized") {
    statusDot.className = "status-dot error";
    statusLabel.textContent = "Não autorizado";
    pairedMessage.textContent = "Dispositivo revogado — conecte novamente.";
  }
});

window.forko.onJobPrinted((payload) => appendLogLine(`✅ ${payload.orderLabel} impresso`));
window.forko.onJobFailed((payload) => appendLogLine(`⚠️ ${payload.orderLabel}: ${payload.message}`));

// ── estado inicial ──────────────────────────────────────────────────
(async () => {
  const { config, officialServerUrl } = await window.forko.getInitialState();
  officialServerUrlLabel.textContent = officialServerUrl ?? "";
  if (config) {
    showPaired(config);
    await loadPrinters(config.printer?.name);
  } else {
    showUnpaired();
  }
})();
