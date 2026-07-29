import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";

/**
 * Sprint "Refatoração da Experiência do Cardápio" (2026-07-28): Categorias
 * e Produtos viraram uma única tela em `/cardapio/categorias`
 * (`<CardapioManager>`). Esta rota fica como redirect — não removida —
 * porque o Dashboard (fora do escopo desta sprint) tem um atalho e um
 * passo de checklist apontando pra cá; assim eles continuam funcionando
 * sem precisar tocar em nenhum arquivo do Dashboard.
 */
export default function ProdutosRedirectPage() {
  redirect(ROUTES.cardapioCategorias);
}
