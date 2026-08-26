import { spawn } from "node:child_process";
import { writeFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrintAdapterError } from "../types.js";

/**
 * FORKO Printer — Etapa 5C (2026-08-24). Camada de TRANSPORTE — só sabe
 * mandar bytes RAW pra uma impressora JÁ instalada no Windows, pelo
 * spooler nativo. Não conhece ESC/POS, `PrintDocument`, API do FORKO,
 * journal nem ACK — mesmo contrato de responsabilidade única do
 * `TcpTransport` (Etapa 5B).
 *
 * ── Por que este caminho, e não outro (decisão da auditoria) ─────────
 * `PowerShell Out-Printer` manda TEXTO pelo pipeline gráfico do driver
 * (GDI) — o driver reformata/reinterpreta o conteúdo, o que destruiria
 * os comandos binários ESC/POS (negrito, corte, code page) exatamente
 * como o pedido queria evitar ("sem converter pra PDF/imagem/documento
 * gráfico"). A única forma confiável de mandar bytes RAW intactos pelo
 * spooler do Windows é a API nativa `winspool.drv`
 * (`OpenPrinter`/`StartDocPrinter` com `pDataType = "RAW"`/`WritePrinter`/
 * `EndDocPrinter`/`ClosePrinter`) — é a MESMA técnica documentada pela
 * própria Microsoft (o antigo "RawPrinterHelper", usado por praticamente
 * toda ferramenta de impressão térmica no Windows que não depende de
 * driver de fabricante).
 *
 * Sem `node-gyp`/dependência nativa Node: quem chama essa API não é o
 * Node diretamente — é um script PowerShell, que usa `Add-Type` (C#
 * compilado EM MEMÓRIA pelo próprio .NET/PowerShell, já embutido no
 * Windows, sem precisar de Visual Studio Build Tools nem nenhum
 * compilador externo instalado à parte).
 *
 * ── Segurança (pedido explícito) ──────────────────────────────────────
 * O `Buffer` NUNCA vira parte de uma linha de comando — é escrito num
 * arquivo temporário binário primeiro, e só o CAMINHO do arquivo (mais o
 * nome da impressora) é passado como PARÂMETRO nomeado do script
 * (`-PrinterName`/`-FilePath`), via `spawn()` com array de argumentos
 * (nunca uma string concatenada/interpolada com dado do usuário — isso
 * evita qualquer risco de injeção de comando, mesmo que o nome da
 * impressora tivesse caracteres estranhos). O arquivo temporário é
 * sempre apagado ao final, sucesso ou falha.
 */

const SPOOLER_SCRIPT = `
param(
  [Parameter(Mandatory=$true)][string]$PrinterName,
  [Parameter(Mandatory=$true)][string]$FilePath
)

$ErrorActionPreference = "Stop"

$source = @"
using System;
using System.Runtime.InteropServices;

public class ForkoRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }

  [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
  public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

  [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, DOCINFOA di);

  [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);
}
"@

# Sem "-Language CSharp": esse parâmetro de "Add-Type" só existe a
# partir do PowerShell 3.0. Windows 7 RTM/SP1 vem de fábrica com
# PowerShell 2.0, onde "-Language" nem é reconhecido — o comando falharia
# antes mesmo de tentar compilar. Remover é seguro: C# já é a linguagem
# padrão de "Add-Type -TypeDefinition" quando "-Language" não é
# especificado, em QUALQUER versão do PowerShell — nenhum comportamento
# muda em máquinas com PowerShell mais novo.
Add-Type -TypeDefinition $source

$bytes = [System.IO.File]::ReadAllBytes($FilePath)

[IntPtr]$hPrinter = [IntPtr]::Zero
if (-not [ForkoRawPrinter]::OpenPrinter($PrinterName, [ref]$hPrinter, [IntPtr]::Zero)) {
  throw "OpenPrinter falhou para '$PrinterName'."
}

try {
  $docInfo = New-Object ForkoRawPrinter+DOCINFOA
  $docInfo.pDocName = "Comanda FORKO"
  $docInfo.pDataType = "RAW"

  if (-not [ForkoRawPrinter]::StartDocPrinter($hPrinter, 1, $docInfo)) {
    throw "StartDocPrinter falhou."
  }
  try {
    if (-not [ForkoRawPrinter]::StartPagePrinter($hPrinter)) {
      throw "StartPagePrinter falhou."
    }
    try {
      [int]$written = 0
      if (-not [ForkoRawPrinter]::WritePrinter($hPrinter, $bytes, $bytes.Length, [ref]$written)) {
        throw "WritePrinter falhou."
      }
      if ($written -ne $bytes.Length) {
        throw "WritePrinter escreveu $written de $($bytes.Length) bytes."
      }
    } finally {
      [void][ForkoRawPrinter]::EndPagePrinter($hPrinter)
    }
  } finally {
    [void][ForkoRawPrinter]::EndDocPrinter($hPrinter)
  }
} finally {
  [void][ForkoRawPrinter]::ClosePrinter($hPrinter)
}

Write-Output "OK"
`;

const LIST_PRINTERS_SCRIPT = `
$ErrorActionPreference = "Stop"
# "Get-WmiObject" (não "Get-CimInstance"): os cmdlets CIM só existem a
# partir do PowerShell 3.0 — no PowerShell 2.0 de fábrica do Windows 7,
# "Get-CimInstance" nem existe como comando. "Get-WmiObject" consulta a
# MESMA classe WMI ("Win32_Printer", mesmas propriedades "Name"/"Default")
# por um caminho mais antigo, presente desde o PowerShell 1.0 — e
# continua funcionando normalmente em versões novas do Windows/PowerShell
# também (cmdlet mantido por compatibilidade, não removido). Uma troca
# só, sem precisar detectar versão de SO nem ramificar o script.
Get-WmiObject -Class Win32_Printer |
  Select-Object Name, Default |
  ConvertTo-Json -Compress
`;

async function runPowerShell(script: string, args: string[]): Promise<string> {
  const tempDir = await mkdtemp(path.join(tmpdir(), "forko-printer-"));
  const scriptPath = path.join(tempDir, "script.ps1");
  await writeFile(scriptPath, script, "utf8");

  try {
    return await new Promise<string>((resolve, reject) => {
      const child = spawn(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...args],
        { windowsHide: true },
      );

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
      child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));

      child.on("error", (err: Error) => {
        reject(
          new PrintAdapterError(
            "windows_spooler_unavailable",
            `Não foi possível executar o PowerShell: ${err.message}`,
            false,
          ),
        );
      });

      child.on("close", (code: number | null) => {
        if (code !== 0) {
          reject(new PrintAdapterError("windows_spooler_error", stderr.trim() || `PowerShell terminou com código ${code}.`, true));
          return;
        }
        resolve(stdout.trim());
      });
    });
  } finally {
    await unlink(scriptPath).catch(() => {});
  }
}

export async function sendViaWindowsSpooler(buffer: Buffer, printerName: string): Promise<void> {
  const tempDir = await mkdtemp(path.join(tmpdir(), "forko-printer-data-"));
  const dataPath = path.join(tempDir, "job.bin");
  await writeFile(dataPath, buffer);

  try {
    await runPowerShell(SPOOLER_SCRIPT, ["-PrinterName", printerName, "-FilePath", dataPath]);
  } finally {
    await unlink(dataPath).catch(() => {});
  }
}

export interface WindowsPrinterInfo {
  name: string;
  isDefault: boolean;
}

export async function listWindowsPrinters(): Promise<WindowsPrinterInfo[]> {
  const output = await runPowerShell(LIST_PRINTERS_SCRIPT, []);
  if (!output) return [];

  const parsed = JSON.parse(output) as { Name: string; Default: boolean } | { Name: string; Default: boolean }[];
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list.map((p) => ({ name: p.Name, isDefault: p.Default }));
}
