// FORKO Printer Desktop — Etapa 6 (2026-08-25).
// Copia `../dist` (o motor compilado por `tsc`, o MESMO usado pela CLI)
// pra dentro de `desktop/dist` — sem isso, o `electron-builder` não
// consegue empacotar um caminho de fora da própria pasta do app de
// forma confiável. Não recompila nada, não duplica lógica nenhuma — só
// copia o resultado que `npm run build` (na raiz de `forko-printer/`)
// já produziu.
const { cpSync, existsSync } = require("node:fs");
const path = require("node:path");

const source = path.join(__dirname, "..", "dist");
const destination = path.join(__dirname, "dist");

if (!existsSync(source)) {
  console.error(
    '[copy-engine] "../dist" não existe. Rode "npm run build" na raiz de forko-printer/ antes de "npm run start"/"npm run dist" aqui dentro de desktop/.',
  );
  process.exit(1);
}

cpSync(source, destination, { recursive: true });
console.log(`[copy-engine] motor copiado de ${source} para ${destination}.`);
