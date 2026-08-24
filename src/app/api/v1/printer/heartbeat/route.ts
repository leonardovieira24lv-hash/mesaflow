import { requirePrinterDevice } from "@/lib/printing/device-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleRouteError } from "@/lib/api/errors";

/**
 * FORKO Printer — Etapa 4 (2026-08-24).
 *
 * POST /api/v1/printer/heartbeat — reforça `last_seen_at`.
 *
 * Achado ao auditar antes de codar: `requirePrinterDevice()`
 * (Etapa 2B) JÁ atualiza `printer_devices.last_seen_at` em TODA chamada
 * autenticada — inclusive `claim`/`result`. Como o agente chama `claim`
 * a cada ~3s quando ocioso, `last_seen_at` já fica fresco só com isso,
 * sem precisar deste endpoint.
 *
 * Mesmo assim, implementado como pedido: serve de reforço pro período em
 * que o agente está PROCESSANDO um job (não chamando `claim` nesse
 * intervalo) — um heartbeat independente, de cadência própria (~30s,
 * ver `forko-printer/src/index.ts`), garante que `last_seen_at` não
 * fique parado por muito tempo mesmo num job mais demorado no futuro
 * (com hardware real). Reaproveita o MESMO helper — nenhuma lógica de
 * "tocar last_seen_at" duplicada aqui, o endpoint só existe pra dar ao
 * agente um jeito de chamar isso fora do ritmo do `claim`.
 */
export async function POST(request: Request) {
  try {
    await requirePrinterDevice(request);
    return apiSuccess({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
