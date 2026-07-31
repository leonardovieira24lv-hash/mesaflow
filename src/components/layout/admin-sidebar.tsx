"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, UtensilsCrossed, LayoutGrid, Wallet, Settings, X } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { useAdminShell } from "@/components/layout/admin-shell-context";

const NAV_ITEMS = [
  { href: ROUTES.dashboard, label: "Dashboard", icon: LayoutDashboard },
  { href: ROUTES.pedidos, label: "Pedidos", icon: ClipboardList },
  { href: ROUTES.cardapioCategorias, label: "Cardápio", icon: UtensilsCrossed },
  { href: ROUTES.mesas, label: "Mesas", icon: LayoutGrid },
  { href: ROUTES.caixa, label: "Caixa", icon: Wallet },
  { href: ROUTES.configuracoes, label: "Configurações", icon: Settings },
] as const;

/**
 * Não depende de `.btn-primary-surface` (classe legada em `globals.css`)
 * — usa `bg-ds2-primary`/`text-ds2-primary-foreground` diretamente.
 * `.btn-primary-surface` perde aqui seu último consumidor administrativo
 * — só resta `menu-item-card.tsx` (Cardápio do cliente, público).
 */
function BrandMark() {
  return (
    <Link href={ROUTES.dashboard} className="flex items-center gap-2.5 px-6 py-6">
      <span
        aria-hidden
        className="flex h-8 w-8 items-center justify-center rounded-ds2-sm bg-ds2-primary font-display text-sm font-bold text-ds2-primary-foreground shadow-ds2-sm"
      >
        M
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-ds2-foreground">MesaFlow</span>
    </Link>
  );
}

/**
 * Item ativo usa `ds2-primary`/`ds2-primary/10` — nunca dourado. Foco
 * visível nativo, mesmo padrão de anel usado no `Button`.
 */
function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-ds2-sm px-3 py-2.5 text-sm font-medium transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds2-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ds2-background",
              active
                ? "bg-ds2-primary/10 text-ds2-foreground"
                : "text-ds2-foreground-muted hover:bg-ds2-primary/5 hover:text-ds2-foreground",
            )}
          >
            {active && (
              <span
                aria-hidden
                className="absolute -left-3 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-ds2-full bg-ds2-primary"
              />
            )}
            <Icon className={cn("h-4 w-4 shrink-0", active && "text-ds2-primary")} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Sidebar de navegação: chrome escuro fixo em telas médias+, drawer deslizante em mobile. */
export function AdminSidebar() {
  const { mobileNavOpen, setMobileNavOpen } = useAdminShell();

  return (
    <>
      {/* Desktop / tablet */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ds2-border bg-ds2-background md:flex">
        <BrandMark />
        <NavLinks />
        <div className="border-t border-ds2-border px-6 py-4 text-xs text-ds2-foreground-muted">
          MesaFlow © {new Date().getFullYear()}
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-ds2-background shadow-ds2-lg animate-slide-in-right">
            <div className="flex items-center justify-between">
              <BrandMark />
              <button
                aria-label="Fechar menu"
                onClick={() => setMobileNavOpen(false)}
                className="mr-3 flex h-11 w-11 items-center justify-center rounded-ds2-sm text-ds2-foreground-muted transition-colors hover:bg-ds2-primary/10 hover:text-ds2-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds2-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ds2-background"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
