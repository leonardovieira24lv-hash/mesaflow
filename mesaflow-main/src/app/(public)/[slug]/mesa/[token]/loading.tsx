import { PageLoading } from "@/components/ui/spinner";

/**
 * Estado de carregamento da página resolvedora do QR Code — não existia
 * antes desta sprint. Esta página nunca renderiza conteúdo próprio (só
 * decide, no servidor, para onde redirecionar — cardápio ou acompanhamento
 * de pedido, ver `mesa/[token]/page.tsx`) e é `force-dynamic`, então sem
 * este `loading.tsx` o primeiro instante depois de escanear o QR Code — a
 * primeira impressão do produto inteiro — era uma tela em branco até a
 * consulta ao banco terminar. Reaproveita `PageLoading`, já usado em outras
 * telas do projeto, em vez de criar um novo componente visual só pra isto.
 */
export default function MesaResolverLoading() {
  return <PageLoading label="Abrindo mesa" />;
}
