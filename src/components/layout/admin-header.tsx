"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { useAdminShell } from "@/components/layout/admin-shell-context";
import { LogoutButton } from "@/components/auth/logout-button";

interface AdminHeaderProps {
  /** E-mail do usuário autenticado, resolvido no layout (Server Component). */
  userEmail?: string | null;
}

/**
 * Mapa próprio de título por rota — não é o mesmo `NAV_ITEMS` da Sidebar
 * ("Dashboard" continua "Dashboard" lá; aqui vira "Início"). Substitui a
 * legenda fixa "Painel do restaurante", que não dizia em qual tela o
 * operador está — o nome do restaurante em si continua existindo só onde
 * já existia (Dashboard/Configurações), o Header nunca repetiu isso.
 */
const ROUTE_TITLES: Array<{ href: string; title: string }> = [
  { href: ROUTES.dashboard, title: "Início" },
  { href: ROUTES.pedidos, title: "Pedidos" },
  { href: ROUTES.cardapioCategorias, title: "Cardápio" },
  { href: ROUTES.mesas, title: "Mesas" },
  { href: ROUTES.caixa, title: "Caixa" },
  { href: ROUTES.configuracoes, title: "Configurações" },
];

function useCurrentRouteTitle(): string {
  const pathname = usePathname();
  const match = ROUTE_TITLES.find(({ href }) => pathname === href || pathname?.startsWith(`${href}/`));
  return match?.title ?? "";
}

/**
 * Header do painel administrativo. O nome/dados do restaurante em si
 * (endpoint 4.1) ficam para o módulo de Restaurante/Configurações — aqui só
 * entra o que pertence à autenticação: identidade do usuário logado e logout.
 */
export function AdminHeader({ userEmail }: AdminHeaderProps) {
  const { mobileNavOpen, setMobileNavOpen } = useAdminShell();
  const routeTitle = useCurrentRouteTitle();

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
          vazio no desktop desde então. Símbolo pequeno aqui, alinhado à
          esquerda (não centralizado) — decisão deliberada do dono pra
          NÃO ficar parecido com o Takeat (referência que ele mesmo
          trouxe), que usa um logo grande centralizado dominando o topo.
          `md:flex` — só aparece a partir do breakpoint onde o título já
          aparece também; no mobile, o "FK" já mora no topo da gaveta de
          navegação (`admin-sidebar.tsx`), não precisa duplicar aqui. */}
      <div className="hidden items-center gap-2.5 md:flex">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-ds2-sm bg-ds2-primary text-[10px] font-bold text-ds2-primary-foreground">
          FK
        </span>
        <span className="text-sm font-medium text-ds2-foreground-muted">{routeTitle}</span>
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
