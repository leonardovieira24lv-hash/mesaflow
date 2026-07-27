import { MenuSkeleton } from "@/components/cardapio-cliente/skeletons";

/**
 * Estado de carregamento do cardápio do cliente. A página é um Server
 * Component que resolve restaurante, mesa e cardápio direto no Supabase
 * antes de renderizar (ver `menu/page.tsx`) — sem este `loading.tsx`, o
 * Next.js não mostra nada até essas consultas terminarem.
 *
 * `MenuSkeleton` mora em `components/cardapio-cliente/skeletons.tsx` —
 * fonte única de verdade, reaproveitada por todos os skeletons do fluxo do
 * cliente (ver o comentário lá para o motivo).
 */
export default function CardapioClienteLoading() {
  return <MenuSkeleton />;
}
