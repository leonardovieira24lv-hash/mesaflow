import type { Route } from "next";

/**
 * Origem canônica do app (para montar URLs absolutas que saem do sistema —
 * hoje só o QR Code de mesa, que vira uma URL impressa e usada por clientes
 * indefinidamente, bem depois de qualquer sessão do admin ter terminado).
 *
 * Bug corrigido aqui: antes, tanto `tables-manager.tsx` quanto
 * `onboarding/tables-form.tsx` usavam só `window.location.origin` —
 * ou seja, o domínio de onde o QR Code é gerado é o mesmo que ele aponta.
 * Isso funciona por acaso quando o admin é acessado pelo domínio de
 * produção certo, mas gera QR Codes reais apontando para
 * `http://localhost:3000`, para uma URL de preview do Vercel, ou para
 * qualquer outro domínio de teste, sempre que a mesa é cadastrada ou o QR
 * é visualizado a partir de um desses — reproduzido e confirmado: o mesmo
 * código, rodando sob três origens diferentes, gera três URLs diferentes
 * para a mesma mesa.
 *
 * `NEXT_PUBLIC_APP_URL` (novo, ver `.env.example`) passa a ser a fonte
 * confiável — inlined em build time pelo Next.js, funciona igual em Server
 * e Client Components. `window.location.origin` continua como fallback
 * só para desenvolvimento local, quando a variável pode não estar
 * configurada.
 */
export function getAppOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  return typeof window !== "undefined" ? window.location.origin : "";
}

/**
 * Anexa `?mesa={token}` a uma rota da Área do Cliente, se houver token.
 * Mesmo padrão introduzido na Fase 3 (`mesa/[token]/page.tsx`) para propagar
 * qual mesa está associada ao cliente entre cardápio → carrinho → checkout
 * → acompanhamento — centralizado aqui para não reescrever o template
 * string em cada página nova.
 */
export function withMesaQuery(route: Route, tableToken: string | null): Route {
  return (tableToken ? `${route}?mesa=${encodeURIComponent(tableToken)}` : route) as Route;
}
