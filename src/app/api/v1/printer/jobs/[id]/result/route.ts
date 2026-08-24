import { requirePrinterDevice } from "@/lib/printing/device-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { printJobResultSchema } from "@/lib/validations/printer";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * FORKO Printer — Etapa 2C (2026-08-24).
 *
 * POST /api/v1/printer/jobs/{id}/result — reporta o resultado de um job
 * reivindicado por este device. Toda a lógica de estado/concorrência
 * (idempotência, autorização, retry/backoff) mora em
 * `report_print_job_result()` (`0055`) — esta rota só traduz HTTP↔RPC.
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const device = await requirePrinterDevice(request);
    const input = parseOrThrow(printJobResultSchema, await request.json());

    const admin = createAdminClient();

    const { data, error } = await admin.rpc("report_print_job_result", {
      p_job_id: id,
      p_device_id: device.deviceId,
      p_status: input.status,
      p_retryable: input.retryable ?? false,
      p_error_code: input.errorCode ?? null,
      p_error_message: input.errorMessage ?? null,
    });

    if (error) {
      if (error.message.includes("INVALID_OR_REVOKED_DEVICE")) {
        throw new AppError("UNAUTHORIZED", "Dispositivo não autorizado.");
      }
      if (error.message.includes("JOB_NOT_AVAILABLE")) {
        // Cobre: job inexistente, de outro restaurante, reivindicado por
        // outro device (cenário H), ou lease expirado e já reivindicado
        // de novo por outro device (cenário G — o ACK atrasado do device
        // antigo cai exatamente aqui, e é recusado). Mensagem genérica de
        // propósito, sem diferenciar qual desses 4 casos é.
        throw new AppError("FORBIDDEN", "Trabalho de impressão não disponível para este dispositivo.");
      }
      throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o resultado. Tente novamente.");
    }

    const job = Array.isArray(data) ? data[0] : data;
    if (!job) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o resultado. Tente novamente.");
    }

    return apiSuccess({
      job: {
        id: job.id as string,
        status: job.status as string,
        attemptCount: job.attempt_count as number,
        nextAttemptAt: job.next_attempt_at as string | null,
        printedAt: job.printed_at as string | null,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
