import { AppError } from "@/lib/api/errors";

/**
 * Limitador de requisições em memória, por chave (contrato seção 3.3:
 * "protegido por rate limiting por table_token"; seção 1.4: `429
 * RATE_LIMITED`).
 *
 * ===========================================================================
 * Reavaliação — Sprint Pós-Auditoria (RC1.1), item 4
 * ===========================================================================
 *
 * A Auditoria Técnica Final apontou que este limitador não é confiável no
 * ambiente real de deploy (Vercel, serverless): cada instância da função
 * tem seu próprio processo Node e, portanto, seu próprio `Map` — não existe
 * um contador único e global por `key`.
 *
 * Decisão desta sprint: **o problema de fundo (contador não-compartilhado
 * entre instâncias) não tem correção real sem algum tipo de store
 * compartilhado** (Redis, ou até a mesma base Postgres já usada pelo
 * projeto) — e a sprint que abriu este item foi explícita: nenhuma
 * infraestrutura nova nesta rodada. Introduzir isso agora seria também uma
 * refatoração maior que o pedido ("melhoria simples"), com uma
 * consequência real de latência (todo request protegido passaria a
 * depender de um round-trip extra a um store externo). Por isso, **não foi
 * implementado** — fica registrado no roadmap como pendência real para uma
 * sprint futura dedicada a isso, não escondido atrás de uma correção
 * cosmética.
 *
 * O que ESTA sprint corrigiu, sem nenhuma infraestrutura nova (só o
 * algoritmo, no mesmo `Map` em memória de sempre): a implementação antiga
 * usava "janela fixa" (fixed window) — o contador zera de uma vez a cada
 * `windowMs`. Isso tem uma fragilidade conhecida independente de
 * ser single-instance ou não: um cliente pode mandar `limit` requisições
 * bem no fim de uma janela e outras `limit` logo no início da próxima,
 * conseguindo `2×limit` requisições numa rajada curta que atravessa a
 * borda das duas janelas. Trocado por um "sliding window counter" —
 * pondera a contagem da janela anterior proporcionalmente a quanto da
 * janela atual já passou, em vez de descartá-la de uma vez. Isso reduz de
 * verdade esse tipo de rajada, dentro de uma única instância — não resolve
 * (e não finge resolver) a falta de contador compartilhado entre
 * instâncias diferentes, que é o problema mais sério e continua em aberto.
 */
interface RateLimitEntry {
  currentWindowStartedAt: number;
  currentWindowCount: number;
  previousWindowCount: number;
  windowMs: number;
}

const hits = new Map<string, RateLimitEntry>();

// Sprint Final (RC1) — correção de confiabilidade: `hits` nunca removia
// entradas antigas, então crescia sem limite pela vida inteira do
// processo (memory leak lento — só afeta um processo de longa duração,
// não instâncias serverless que reiniciam sozinhas, mas é barato de
// corrigir mesmo assim). Em vez de um `setInterval` próprio (que ficaria
// rodando mesmo sem nenhuma requisição — ruim justamente no ambiente
// serverless que este módulo já avisa não ser o alvo principal), a
// limpeza acontece de carona nas próprias chamadas: a cada
// `CLEANUP_INTERVAL_CALLS` chamadas, varre e remove entradas cuja janela
// atual E anterior já expiraram de verdade (uma entrada "desliza" entre
// janelas — só está de fato inativa quando as duas ficaram velhas).
const CLEANUP_INTERVAL_CALLS = 200;
let callsSinceCleanup = 0;

function cleanupExpiredEntries(now: number): void {
  for (const [key, entry] of hits) {
    if (now - entry.currentWindowStartedAt >= entry.windowMs * 2) {
      hits.delete(key);
    }
  }
}

interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

/**
 * Lança `429 RATE_LIMITED` se `key` já excedeu `limit` chamadas dentro da
 * janela deslizante de `windowMs`. Caso contrário, registra esta chamada e
 * retorna normalmente.
 */
export function assertWithinRateLimit(key: string, { limit, windowMs }: RateLimitOptions): void {
  const now = Date.now();

  callsSinceCleanup += 1;
  if (callsSinceCleanup >= CLEANUP_INTERVAL_CALLS) {
    callsSinceCleanup = 0;
    cleanupExpiredEntries(now);
  }

  const entry = hits.get(key);

  if (!entry || now - entry.currentWindowStartedAt >= windowMs * 2) {
    // Sem entrada, ou tão velha que não há nada "deslizando" de verdade —
    // começa uma janela nova do zero.
    hits.set(key, { currentWindowStartedAt: now, currentWindowCount: 1, previousWindowCount: 0, windowMs });
    return;
  }

  if (now - entry.currentWindowStartedAt >= windowMs) {
    // A janela atual acabou de virar — a que estava "atual" vira "anterior"
    // (ainda pesa na contagem, proporcionalmente), e uma nova começa vazia.
    entry.previousWindowCount = entry.currentWindowCount;
    entry.currentWindowCount = 0;
    entry.currentWindowStartedAt += windowMs;
  }

  const fractionElapsed = (now - entry.currentWindowStartedAt) / windowMs;
  const weightedPreviousCount = entry.previousWindowCount * (1 - fractionElapsed);
  const estimatedCount = entry.currentWindowCount + weightedPreviousCount;

  if (estimatedCount >= limit) {
    throw new AppError(
      "RATE_LIMITED",
      "Muitos pedidos enviados em pouco tempo. Aguarde um instante e tente novamente.",
    );
  }

  entry.currentWindowCount += 1;
}
