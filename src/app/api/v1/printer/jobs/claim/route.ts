import { requirePrinterDevice } from "@/lib/printing/device-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { isPrintDocument } from "@/types/printing";

/**
 * FORKO Printer — Etapa 2C (2026-08-24).
 *
 * POST /api/v1/printer/jobs/claim — device autenticado reivindica 0 ou 1
 * job pendente do próprio restaurante (`claim_next_print_job`, `0054`,
 * já garante isolamento por restaurante e concorrência via `FOR UPDATE
 * SKIP LOCKED` — nada disso é reimplementado aqui).
 *
 * Sem corpo de requisição nesta etapa (lease fica no default de 60s da
 * própria RPC, sem override externo — decisão explícita do pedido, "pra
 * MVP prefiro manter simples").
 *
 * Resposta enxuta de propósito ("não devolver campos internos
 * desnecessários") — nunca `restaurant_id`, `claimed_by` (o próprio
 * device já sabe quem é), nem os timestamps de auditoria.
 */
export async function POST(request: Request) {
  try {
    const device = await requirePrinterDevice(request);
    const admin = createAdminClient();

    const { data, error } = await admin.rpc("claim_next_print_job", {
      p_device_id: device.deviceId,
    });

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível buscar um trabalho de impressão. Tente novamente.");
    }

    const job = Array.isArray(data) ? data[0] : data;

    if (!job) {
      return apiSuccess({ job: null });
    }

    if (!isPrintDocument(job.document)) {
      // Não deveria acontecer nunca (o `document` é montado por
      // `build_print_document_snapshot()` na Etapa 1, sempre na mesma
      // forma) — se acontecer, é sinal de algo errado no dado em si, não
      // um erro de autenticação/autorização. Não devolve o job quebrado.
      throw new AppError("INTERNAL_ERROR", "Trabalho de impressão com documento inválido.");
    }

    return apiSuccess({
      job: {
        id: job.id as string,
        destination: job.destination as string,
        document: job.document,
        attemptCount: job.attempt_count as number,
        leaseExpiresAt: job.lease_expires_at as string,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
