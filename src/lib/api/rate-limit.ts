import { AppError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Limitador de requisições compartilhado (contrato seção 3.3: "protegido
 * por rate limiting por table_token"; seção 1.4: `429 RATE_LIMITED`).
 *
 * ===========================================================================
 * Correção de confiabilidade — 2026-08-15
 * ===========================================================================
 *
 * Até aqui, este módulo guardava a contagem num `Map` em memória do
 * próprio processo Node — funcionava bem localmente, mas no ambiente real
 * de deploy (Vercel, serverless) cada instância da função tem seu próprio
 * processo e, portanto, seu próprio `Map`. Não existia um contador único
 * e global por `key`: 20 instâncias concorrentes = 20 limites de `N`
 * cada, não um limite de `N` de verdade. Isso já estava documentado aqui
 * mesmo como pendência conhecida havia tempo.
 *
 * Correção (decisão do dono, 2026-08-15): reaproveitar o Postgres já
 * usado pelo projeto em vez de introduzir Redis/Upstash — sem serviço
 * novo pra gerenciar. A contagem em si (mesmo algoritmo de "janela
 * deslizante" que já existia aqui, ponderando a janela anterior pra
 * evitar a rajada de 2×limit na borda entre duas janelas fixas) agora
 * mora inteira dentro da função `check_rate_limit` (migration `0040`),
 * protegida por `select ... for update` — a linha daquela chave trava
 * enquanto a função roda, então duas requisições concorrentes pra MESMA
 * chave (de instâncias diferentes, não importa) nunca competem "por
 * baixo do pano": a segunda espera a primeira terminar antes de ler o
 * valor.
 *
 * Assinatura mudou de síncrona pra assíncrona (agora depende de uma
 * consulta ao banco) — todo chamador precisa de `await` a partir de
 * agora. Trade-off aceito: alguns milissegundos a mais por requisição
 * protegida, imperceptível no volume atual.
 */
interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

/**
 * Lança `429 RATE_LIMITED` se `key` já excedeu `limit` chamadas dentro da
 * janela deslizante de `windowMs`. Caso contrário, registra esta chamada e
 * retorna normalmente.
 *
 * Propositalmente "falha aberta" (fail open): se a checagem em si der
 * erro (o banco estiver fora do ar, por exemplo), deixa a requisição
 * passar em vez de bloquear todo o app por causa de uma proteção
 * secundária — o objetivo do rate limiter é conter abuso, não virar ele
 * mesmo um ponto único de falha que derruba pedido/chamar garçom/etc.
 * pra todo cliente legítimo. Decisão deliberada, dado o medo explícito do
 * dono de "restaurante parado por causa do Forko" — vale reavaliar se um
 * dia o volume justificar o oposto.
 */
export async function assertWithinRateLimit(key: string, { limit, windowMs }: RateLimitOptions): Promise<void> {
  const admin = createAdminClient();

  const { data: allowed, error } = await admin.rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_ms: windowMs,
  });

  if (error) {
    console.error("[rate-limit] check_rate_limit falhou — deixando passar (fail open):", error);
    return;
  }

  if (!allowed) {
    throw new AppError(
      "RATE_LIMITED",
      "Muitos pedidos enviados em pouco tempo. Aguarde um instante e tente novamente.",
    );
  }
}
