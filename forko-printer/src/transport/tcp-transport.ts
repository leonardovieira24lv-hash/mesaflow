import { Socket } from "node:net";
import { PrintAdapterError } from "../types.js";

/**
 * FORKO Printer — Etapa 5B (2026-08-24). Camada de TRANSPORTE — só sabe
 * mandar bytes pra algum lugar. Não sabe nada de ESC/POS, comanda,
 * negrito ou qualquer regra de conteúdo — recebe um `Buffer` pronto e
 * entrega. `net.Socket` nativo do Node, sem dependência externa.
 */

export interface TcpTransportOptions {
  host: string;
  port: number;
  /** ms — pedido explícito, default 5000. Nunca fica pendurado
   *  indefinidamente esperando uma impressora desligada responder. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5_000;

export function sendViaTcp(buffer: Buffer, options: TcpTransportOptions): Promise<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const socket = new Socket();
    let settled = false;

    function fail(code: string, message: string) {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new PrintAdapterError(code, message, true));
    }

    socket.setTimeout(timeoutMs);

    socket.once("timeout", () => fail("printer_connection_timeout", `Tempo esgotado ao conectar em ${options.host}:${options.port}.`));

    socket.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ECONNREFUSED") {
        fail("printer_connection_refused", `Conexão recusada por ${options.host}:${options.port}.`);
      } else if (err.code === "EHOSTUNREACH" || err.code === "ENETUNREACH") {
        fail("printer_network_unreachable", `Impressora inalcançável em ${options.host}.`);
      } else if (err.code === "ECONNRESET") {
        fail("printer_transport_error", "Conexão com a impressora foi reiniciada durante o envio.");
      } else {
        fail("printer_transport_error", err.message);
      }
    });

    socket.connect(options.port, options.host, () => {
      socket.write(buffer, (writeErr?: Error | null) => {
        if (writeErr) {
          fail("printer_transport_error", writeErr.message);
          return;
        }
        socket.end();
      });
    });

    socket.once("close", () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    });
  });
}
