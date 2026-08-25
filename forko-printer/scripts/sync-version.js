// FORKO Printer — Etapa 7 (2026-08-25).
// Fonte única de verdade pra versão: `forko-printer/package.json`.
// Este script copia esse valor pra `desktop/package.json` ANTES do
// build — evita 2 números de versão mantidos manualmente, que
// divergiam com o tempo. Sem sistema de versionamento complexo, só uma
// cópia de campo, rodada pelo workflow (e disponível pra rodar na mão
// também, `node scripts/sync-version.js`).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootPkgPath = path.join(__dirname, "..", "package.json");
const desktopPkgPath = path.join(__dirname, "..", "desktop", "package.json");

const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf8"));
const desktopPkg = JSON.parse(readFileSync(desktopPkgPath, "utf8"));

if (desktopPkg.version === rootPkg.version) {
  console.log(`[sync-version] já sincronizado (${rootPkg.version}) — nada a fazer.`);
  process.exit(0);
}

desktopPkg.version = rootPkg.version;
writeFileSync(desktopPkgPath, JSON.stringify(desktopPkg, null, 2) + "\n", "utf8");
console.log(`[sync-version] desktop/package.json atualizado para ${rootPkg.version}.`);
