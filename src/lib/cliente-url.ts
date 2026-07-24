import type { Route } from "next";

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
