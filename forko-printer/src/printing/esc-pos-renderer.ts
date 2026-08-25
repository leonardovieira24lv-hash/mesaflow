import type { ReceiptLine } from "../types.js";

/**
 * FORKO Printer — Etapa 5B (2026-08-24). Camada de FORMATAÇÃO/PROTOCOLO
 * — traduz `ReceiptLine[]` (conteúdo puro, sem saber de hardware) em
 * bytes ESC/POS. Não sabe nada de TCP/USB/Windows — só sabe gerar o
 * `Buffer` final.
 *
 * Comandos ESC/POS usados, todos essenciais/amplamente compatíveis
 * (pedido explícito — "implementar somente comandos essenciais"):
 *   ESC @      (0x1B 0x40)       — inicializa a impressora
 *   ESC t n    (0x1B 0x74 n)     — seleciona code page
 *   ESC a n    (0x1B 0x61 n)     — alinhamento (0=esq, 1=centro, 2=dir)
 *   ESC E n    (0x1B 0x45 n)     — negrito on/off (1/0)
 *   GS  ! n    (0x1D 0x21 n)     — tamanho do caractere (0x01=largura dupla)
 *   GS  V n    (0x1D 0x56 n)     — corte de papel (0x00=corte total)
 *
 * Toda linha estilizada RESTAURA o estilo padrão depois de imprimir
 * (pedido explícito: "sempre restaurar estilos... para não contaminar
 * as seguintes") — nunca deixa negrito/largura dupla "vazando" pra
 * linha de baixo.
 */

const ESC = 0x1b;
const GS = 0x1d;

/**
 * ── Acentuação (pedido explícito: nenhuma solução falsa de charset) ──
 *
 * ESC/POS genérico não fala UTF-8 — cada impressora usa uma "code page"
 * de 1 byte por caractere. A maioria das térmicas vendidas no Brasil
 * suporta CP860 (Portuguese) ou CP850 (Latin-1), selecionável via
 * `ESC t n`. Sem biblioteca externa (pedido explícito — "não instalar
 * lib pesada só por isso"), construí uma tabela PRÓPRIA, pequena,
 * cobrindo só os caracteres acentuados do português — não é um
 * conversor de codepage genérico, é deliberadamente limitado ao que o
 * PT-BR realmente usa.
 *
 * `CODEPAGE_SELECT_BYTE = 3` é o valor mais comum pra CP860 em
 * controladores compatíveis Epson (a maioria das térmicas genéricas) —
 * mas isto VARIA por fabricante. O comando `npm run test-print`
 * (`index.ts`) imprime "ÁÉÍÓÚ Ç Ã Õ" de propósito — é o jeito real de
 * confirmar se esse valor bate com a impressora específica do
 * restaurante antes de confiar nisso em produção.
 *
 * Caractere fora da tabela: mantém o byte UTF-8 original (não remove o
 * acento silenciosamente) — pode sair errado na impressora se não for
 * PT-BR comum, mas nunca damos a impressão falsa de "sem acentos = tudo
 * ok".
 */
const CODEPAGE_SELECT_BYTE = 3; // CP860 (Portuguese), controladores compatíveis Epson

const ACCENT_TO_CP860: Record<string, number> = {
  á: 0xa0, é: 0x82, í: 0xa1, ó: 0xa2, ú: 0xa3,
  à: 0x85, â: 0x83, ã: 0x84, ê: 0x88, ô: 0x93, õ: 0x94,
  ç: 0x87, ñ: 0xa4, ü: 0x81,
  Á: 0xb5, É: 0x90, Í: 0xd6, Ó: 0xe0, Ú: 0xe9,
  À: 0xb7, Â: 0xb6, Ã: 0xc7, Ê: 0xd2, Ô: 0xe2, Õ: 0xc8,
  Ç: 0x80, Ñ: 0xa5, Ü: 0x9a,
};

function encodeText(text: string): Buffer {
  const bytes: number[] = [];
  for (const char of text) {
    const mapped = ACCENT_TO_CP860[char];
    if (mapped !== undefined) {
      bytes.push(mapped);
    } else {
      // ASCII comum e qualquer coisa fora da tabela — bytes UTF-8
      // originais (ver docstring acima: nunca remove silenciosamente).
      bytes.push(...Buffer.from(char, "utf8"));
    }
  }
  return Buffer.from(bytes);
}

function alignByte(align: ReceiptLine["align"]): number {
  if (align === "center") return 1;
  if (align === "right") return 2;
  return 0;
}

export function renderEscPos(lines: ReceiptLine[], hasCutter: boolean): Buffer {
  const chunks: Buffer[] = [];

  chunks.push(Buffer.from([ESC, 0x40])); // initialize
  chunks.push(Buffer.from([ESC, 0x74, CODEPAGE_SELECT_BYTE])); // code page

  for (const line of lines) {
    chunks.push(Buffer.from([ESC, 0x61, alignByte(line.align)]));
    if (line.bold) chunks.push(Buffer.from([ESC, 0x45, 1]));
    if (line.doubleWidth) chunks.push(Buffer.from([GS, 0x21, 0x01]));

    chunks.push(encodeText(line.text));
    chunks.push(Buffer.from("\n", "ascii"));

    // Restaura pra próxima linha nunca herdar o estilo desta.
    if (line.doubleWidth) chunks.push(Buffer.from([GS, 0x21, 0x00]));
    if (line.bold) chunks.push(Buffer.from([ESC, 0x45, 0]));
    chunks.push(Buffer.from([ESC, 0x61, 0])); // volta pro alinhamento padrão (esquerda)
  }

  // Avanço de papel antes do corte — folga pra não cortar em cima do
  // texto (comum em impressoras sem margem inferior configurável).
  chunks.push(Buffer.from("\n\n\n", "ascii"));

  if (hasCutter) {
    chunks.push(Buffer.from([GS, 0x56, 0x00])); // corte total — SÓ se hasCutter=true
  }

  return Buffer.concat(chunks);
}
