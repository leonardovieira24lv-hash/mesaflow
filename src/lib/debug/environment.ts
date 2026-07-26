/**
 * Debug Tools — informações de ambiente/build.
 *
 * `VERCEL_ENV`/`VERCEL_GIT_COMMIT_SHA` são injetadas automaticamente pela
 * Vercel em todo deploy (não precisam ser configuradas manualmente) — mas só
 * existem quando o build realmente roda lá. Fora da Vercel (dev local),
 * ficam `undefined` e caímos no fallback de `NODE_ENV`.
 *
 * Compartilhado por todas as páginas do módulo Debug Tools
 * (`/admin/debug/*`) para não duplicar essa lógica em cada uma.
 */
export interface DebugEnvironmentInfo {
  ambiente: string;
  build: string;
  appUrl: string;
}

export function getDebugEnvironmentInfo(): DebugEnvironmentInfo {
  const vercelEnv = process.env.VERCEL_ENV; // "production" | "preview" | "development"
  const ambiente = vercelEnv
    ? { production: "Production", preview: "Preview", development: "Development" }[vercelEnv] ?? vercelEnv
    : `${process.env.NODE_ENV ?? "desconhecido"} (sem VERCEL_ENV — não está rodando via Vercel)`;

  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA;
  const commitMessage = process.env.VERCEL_GIT_COMMIT_MESSAGE;
  const build = commitSha
    ? `${commitSha.slice(0, 7)}${commitMessage ? ` — ${commitMessage.slice(0, 60)}` : ""}`
    : "desconhecido (sem VERCEL_GIT_COMMIT_SHA)";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "(NEXT_PUBLIC_APP_URL não definida)";

  return { ambiente, build, appUrl };
}
