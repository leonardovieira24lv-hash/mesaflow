import { Facebook, Globe, Instagram } from "lucide-react";

/**
 * Rodapé de redes sociais — Cardápio Público (2026-08-18). Dono percebeu
 * que preenchia Instagram/Facebook/Site em Configurações/Perfil, mas
 * isso nunca chegava no cliente final — `resolve-public-context.ts` nem
 * buscava essas colunas. Corrigido lá, este componente é quem exibe.
 *
 * Telefone/WhatsApp/endereço ficaram de fora DE PROPÓSITO — decisão do
 * dono: o cliente já está fisicamente no estabelecimento (chegou aqui
 * escaneando o QR da mesa), então essas informações são redundantes
 * nesse contexto específico. Só redes sociais sobrevivem — fazem
 * sentido mesmo com o cliente já presente (seguir pra promoções
 * futuras, marcar o restaurante numa foto).
 *
 * Fica no FIM da página (depois de toda a lista de produtos), como um
 * rodapé de verdade — não compete com o cardápio em si, só aparece
 * quando o cliente rola até o final.
 *
 * Usa tokens de tema (`border-border`, `bg-muted`, `text-muted-foreground`
 * etc.), nunca cor fixa — o Cardápio Público pode estar em tema claro ou
 * escuro (`menuTheme`, escolha do restaurante), e este componente precisa
 * funcionar certo nos dois sem nenhuma lógica própria de tema.
 *
 * Nenhum ícone aparece se o campo correspondente não foi preenchido — sem
 * espaço vazio/quebrado. Se NENHUM dos 3 estiver preenchido, o componente
 * inteiro não renderiza nada (retorna `null`).
 */

interface PublicFooterProps {
  instagram: string | null;
  facebook: string | null;
  website: string | null;
}

/** Aceita tanto "@usuario"/"usuario" quanto uma URL completa já salva —
 *  o campo de Configurações/Perfil sempre foi de texto livre, sem
 *  validação de formato, então esta função tem que lidar com qualquer
 *  um dos dois sem quebrar o link. */
function toInstagramUrl(value: string): string {
  if (value.startsWith("http")) return value;
  return `https://instagram.com/${value.replace(/^@/, "")}`;
}

function toFacebookUrl(value: string): string {
  if (value.startsWith("http")) return value;
  return `https://facebook.com/${value}`;
}

function toWebsiteUrl(value: string): string {
  if (value.startsWith("http")) return value;
  return `https://${value}`;
}

export function PublicFooter({ instagram, facebook, website }: PublicFooterProps) {
  const links = [
    instagram && { key: "instagram", href: toInstagramUrl(instagram), Icon: Instagram, label: "Instagram" },
    facebook && { key: "facebook", href: toFacebookUrl(facebook), Icon: Facebook, label: "Facebook" },
    website && { key: "website", href: toWebsiteUrl(website), Icon: Globe, label: "Site" },
  ].filter((link): link is { key: string; href: string; Icon: typeof Instagram; label: string } => Boolean(link));

  if (links.length === 0) return null;

  return (
    <footer className="flex justify-center border-t border-border px-4 py-6">
      <div className="flex items-center gap-3">
        {links.map(({ key, href, Icon, label }) => (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          >
            <Icon className="h-4 w-4" aria-hidden />
          </a>
        ))}
      </div>
    </footer>
  );
}
