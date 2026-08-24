import type {
  AgentConfig,
  ApiEnvelope,
  ApiErrorEnvelope,
  ClaimedJob,
  PrintJobResultRequest,
} from "./types.js";

/**
 * FORKO Printer — Etapa 3A (2026-08-24). Cliente dos 3 endpoints REAIS,
 * lidos direto do código antes de escrever isto — nenhum formato
 * presumido. Só `fetch` nativo (pedido explícito: preferir recursos
 * nativos do Node moderno, sem framework HTTP).
 */

export class UnauthorizedError extends Error {
  constructor() {
    super("Dispositivo não autorizado.");
    this.name = "UnauthorizedError";
  }
}

function normalizeServerUrl(url: string): string {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("URL do servidor precisa começar com http:// ou https://.");
  }
  return trimmed.replace(/\/+$/, "");
}

async function parseJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiEnvelope<T> | ApiErrorEnvelope;
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new UnauthorizedError();
    }
    const message = "error" in body ? body.error.message : `Erro HTTP ${response.status}.`;
    throw new Error(message);
  }
  return (body as ApiEnvelope<T>).data;
}

export async function pairDevice(
  serverUrl: string,
  code: string,
  deviceName: string,
): Promise<{ deviceId: string; deviceToken: string; restaurantId: string }> {
  const base = normalizeServerUrl(serverUrl);
  const response = await fetch(`${base}/api/v1/printer/pair`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, deviceName }),
  });
  const data = await parseJson<{ device: { id: string; restaurantId: string }; deviceToken: string }>(response);
  return { deviceId: data.device.id, deviceToken: data.deviceToken, restaurantId: data.device.restaurantId };
}

export async function claimJob(config: AgentConfig): Promise<ClaimedJob | null> {
  const response = await fetch(`${config.serverUrl}/api/v1/printer/jobs/claim`, {
    method: "POST",
    headers: { authorization: `Bearer ${config.deviceToken}` },
  });
  const data = await parseJson<{ job: ClaimedJob | null }>(response);
  return data.job;
}

export async function reportResult(
  config: AgentConfig,
  jobId: string,
  result: PrintJobResultRequest,
): Promise<void> {
  const response = await fetch(`${config.serverUrl}/api/v1/printer/jobs/${jobId}/result`, {
    method: "POST",
    headers: { authorization: `Bearer ${config.deviceToken}`, "content-type": "application/json" },
    body: JSON.stringify(result),
  });
  await parseJson<{ job: { id: string; status: string } }>(response);
}

/** Etapa 4 (2026-08-24) — reforço de `last_seen_at` fora do ritmo do
 *  `claim` (ver `POST /api/v1/printer/heartbeat`, backend). Mesmo
 *  `parseJson`/tratamento de erro dos outros 2 endpoints — nenhum
 *  padrão novo. */
export async function sendHeartbeat(config: AgentConfig): Promise<void> {
  const response = await fetch(`${config.serverUrl}/api/v1/printer/heartbeat`, {
    method: "POST",
    headers: { authorization: `Bearer ${config.deviceToken}` },
  });
  await parseJson<{ ok: boolean }>(response);
}
