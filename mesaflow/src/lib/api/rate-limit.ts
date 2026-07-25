import { AppError } from "@/lib/api/errors";

/**
 * Limitador de requisições em memória, por chave (contrato seção 3.3:
 * "protegido por rate limiting por table_token"; seção 1.4: `429
 * RATE_LIMITED`).
 *
 * Janela fixa, guardada em memória do próprio processo — suficiente para
 * proteger contra flood básico numa única instância, mas **não** é
 * compartilhada entre múltiplas instâncias/regiões simultâneas em produção
 * (cada instância serverless tem seu próprio contador). Se o projeto crescer
 * para múltiplas instâncias concorrentes, isto precisa migrar para um store
 * compartilhado (ex.: Upstash Redis) — documentado aqui para não ser
 * esquecido, não é um bloqueador desta sprint.
 */
const hits = new Map<string, { count: number; windowStartedAt: number }>();

interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

/**
 * Lança `429 RATE_LIMITED` se `key` já excedeu `limit` chamadas dentro da
 * janela `windowMs`. Caso contrário, registra esta chamada e retorna
 * normalmente.
 */
export function assertWithinRateLimit(key: string, { limit, windowMs }: RateLimitOptions): void {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now - entry.windowStartedAt >= windowMs) {
    hits.set(key, { count: 1, windowStartedAt: now });
    return;
  }

  if (entry.count >= limit) {
    throw new AppError(
      "RATE_LIMITED",
      "Muitos pedidos enviados em pouco tempo. Aguarde um instante e tente novamente.",
    );
  }

  entry.count += 1;
}
