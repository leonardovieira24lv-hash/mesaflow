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
  pedidoDetalhe: (id: string) => `/pedidos/${id}`,
  cardapioCategorias: "/cardapio/categorias",
  cardapioProdutos: "/cardapio/produtos",
  cardapioProdutoDetalhe: (id: string) => `/cardapio/produtos/${id}`,
  mesas: "/mesas",
  configuracoes: "/configuracoes",

  // Área do cliente (pública, sem login)
  clienteMesa: (slug: string, token: string) => `/${slug}/mesa/${token}`,
  clienteMenu: (slug: string) => `/${slug}/menu`,
  clienteAcompanharPedido: (slug: string, orderId: string) => `/${slug}/orders/${orderId}`,
} as const;

/** Prefixo único de versão da API — qualquer chamada ao backend passa por aqui. */
export const API_BASE = "/api/v1";
