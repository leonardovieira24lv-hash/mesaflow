// FORKO Printer Desktop — Etapa 6 (2026-08-25).
// `contextIsolation: true` + `contextBridge` — o renderer nunca tem
// acesso direto ao Node/Electron, só a esta API explícita e mínima.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("forko", {
  getInitialState: () => ipcRenderer.invoke("forko:get-initial-state"),
  pair: (input) => ipcRenderer.invoke("forko:pair", input),
  listPrinters: () => ipcRenderer.invoke("forko:list-printers"),
  savePrinterSettings: (input) => ipcRenderer.invoke("forko:save-printer-settings", input),
  testPrint: () => ipcRenderer.invoke("forko:test-print"),
  reset: () => ipcRenderer.invoke("forko:reset"),
  quit: () => ipcRenderer.invoke("forko:quit"),

  onLog: (callback) => ipcRenderer.on("forko:log", (_event, line) => callback(line)),
  onStatus: (callback) => ipcRenderer.on("forko:status", (_event, status) => callback(status)),
  onJobPrinted: (callback) => ipcRenderer.on("forko:job-printed", (_event, payload) => callback(payload)),
  onJobFailed: (callback) => ipcRenderer.on("forko:job-failed", (_event, payload) => callback(payload)),
});
