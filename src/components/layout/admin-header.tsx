"use client";

import { Menu } from "lucide-react";
import { useAdminShell } from "@/components/layout/admin-shell-context";
import { LogoutButton } from "@/components/auth/logout-button";

interface AdminHeaderProps {
  /** E-mail do usuário autenticado, resolvido no layout (Server Component). */
  userEmail?: string | null;
}

/**
 * Header do painel administrativo. O nome/dados do restaurante em si
 * (endpoint 4.1) ficam para o módulo de Restaurante/Configurações — aqui só
 * entra o que pertence à autenticação: identidade do usuário logado e logout.
 *
 * Sprint "Responsividade Desktop — limpeza do header" (2026-08-17): o
 * título por rota ("Mesas", "Pedidos" etc., que ficava ao lado da logo)
 * saiu a pedido do dono — junto com a consolidação da tela de Mesas
 * numa única linha, o nome da tela virou redundante (o próprio conteúdo
 * já deixa claro onde você está). `ROUTE_TITLES`/`useCurrentRouteTitle`
 * (que só existiam pra alimentar esse texto) foram removidos junto —
 * sem uso nenhum sobrando no arquivo.
 */
export function AdminHeader({ userEmail }: AdminHeaderProps) {
  const { mobileNavOpen, setMobileNavOpen } = useAdminShell();

  return (
    <header className="flex h-16 items-center justify-between border-b border-ds2-border bg-ds2-surface/80 px-4 backdrop-blur-sm md:px-8">
      <button
        aria-label="Abrir menu"
        aria-expanded={mobileNavOpen}
        onClick={() => setMobileNavOpen(true)}
        className="-ml-2 flex h-11 w-11 items-center justify-center rounded-ds2-sm text-ds2-foreground-muted transition-colors hover:bg-ds2-surface-hover hover:text-ds2-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds2-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ds2-background md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Sprint "Responsividade Desktop — Logo no Header" (2026-08-16):
          o logo saiu da sidebar (virou quadros de navegação, sem
          identidade escrita) — esse espaço, à esquerda do título, ficou
          vazio no desktop desde então. Logo aqui, alinhada à esquerda
          (não centralizada) — decisão deliberada do dono pra NÃO ficar
          parecido com o Takeat (referência que ele mesmo trouxe), que
          usa um logo grande centralizado dominando o topo.
          Imagem completa (`/logo-forko-novo.png`, ícone + "FORKO"
          escrito — recortada do arquivo em alta resolução que o dono
          mandou, removendo o espaço vazio ao redor). Passou por uma
          versão intermediária só com o ícone (sem o texto) — o dono
          pediu explicitamente a logo inteira, não só o símbolo.
          `md:flex` — só aparece a partir do breakpoint onde o título já
          aparece também; no mobile, a logo já mora no topo da gaveta de
          navegação (`admin-sidebar.tsx`), não precisa duplicar aqui. */}
      <div className="hidden items-center gap-2.5 md:flex">
        {/* eslint-disable-next-line @next/next/no-img-element -- proporção fixa conhecida, mesmo padrão já usado nas outras logos do projeto. */}
        <img src="/logo-forko-novo.png" alt="Forko" className="h-6 w-auto shrink-0" />
      </div>

      <div className="flex items-center gap-3">
        {userEmail && (
          <span className="hidden rounded-ds2-full bg-ds2-surface-hover px-3 py-1 text-sm text-ds2-foreground-muted sm:inline">
            {userEmail}
          </span>
        )}
        <LogoutButton />
      </div>
    </header>
  );
}
