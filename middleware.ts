import { type NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";

/**
 * Middleware raiz. Três responsabilidades:
 *  1. Renovar o token de sessão Supabase a cada requisição (necessário com
 *     `@supabase/ssr`, senão a sessão expira silenciosamente).
 *  2. Redirecionar para `/login` quem tentar acessar rotas administrativas
 *     sem sessão — proteção de UX; a segurança de fato é feita por RLS +
 *     `requireSession`/`requireOwner` na Route Handler (contrato seção 1.6).
 *  3. Redirecionar para o dashboard quem já estiver logado e tentar acessar
 *     `/login` — evita o formulário aparecer para quem já tem sessão ativa.
 *
 * Rotas públicas (`/[slug]/...`, `/api/v1/public/...`) nunca passam por
 * nenhuma dessas checagens de sessão.
 */
export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdminRoute = ADMIN_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isAdminRoute && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect_to", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

const ADMIN_ROUTE_PREFIXES = [
  "/dashboard",
  "/pedidos",
  "/cardapio",
  "/mesas",
  "/configuracoes",
];

export const config = {
  matcher: [
    /*
     * Roda em tudo exceto assets estáticos e internals do Next —
     * inclui as rotas de página E as de API administrativa.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
