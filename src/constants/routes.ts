import type { Route } from "next";

/**
 * Rotas do app (front-end), centralizadas para evitar strings soltas espalhadas
 * pelos componentes. Não confundir com as rotas de API (essas vivem sob
 * `src/app/api/v1/...` e seguem o contrato em `api-contracts-v1.md`).
 */
export const ROUTES = {
  // Autenticação / onboarding
  login: "/login",
  esqueciSenha: "/esqueci-senha",
  redefinirSenha: "/redefinir-senha",
  onboardingRestaurante: "/onboarding/restaurante",
  onboardingMesas: "/onboarding/mesas",

  // Painel administrativo
  dashboard: "/dashboard",
  pedidos: "/pedidos",

  pedidoDetalhe: (id: string): Route =>
    `/pedidos/${id}` as Route,

  cardapioCategorias: "/cardapio/categorias",
  cardapioProdutos: "/cardapio/produtos",

  cardapioProdutoDetalhe: (id: string): Route =>
    `/cardapio/produtos/${id}` as Route,

  mesas: "/mesas",
  configuracoes: "/configuracoes",

  // Área do cliente (pública, sem login)
  clienteMesa: (slug: string, token: string): Route =>
    `/${slug}/mesa/${token}` as Route,

  clienteMenu: (slug: string): Route =>
    `/${slug}/menu` as Route,

  clienteAcompanharPedido: (
    slug: string,
    orderId: string,
  ): Route =>
    `/${slug}/orders/${orderId}` as Route,
} as const;

/** Prefixo único de versão da API — qualquer chamada ao backend passa por aqui. */
export const API_BASE = "/api/v1";