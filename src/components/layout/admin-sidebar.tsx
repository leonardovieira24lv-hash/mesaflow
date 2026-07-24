"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, UtensilsCrossed, LayoutGrid, Settings, X } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { useAdminShell } from "@/components/layout/admin-shell-context";

const NAV_ITEMS = [
  { href: ROUTES.dashboard, label: "Dashboard", icon: LayoutDashboard },
  { href: ROUTES.pedidos, label: "Pedidos", icon: ClipboardList },
  { href: ROUTES.cardapioCategorias, label: "Cardápio", icon: UtensilsCrossed },
  { href: ROUTES.mesas, label: "Mesas", icon: LayoutGrid },
  { href: ROUTES.configuracoes, label: "Configurações", icon: Settings },
] as const;

function BrandMark() {
  return (
    <Link href={ROUTES.dashboard} className="flex items-center gap-2.5 px-6 py-6">
      <span
        aria-hidden
        className="btn-primary-surface flex h-8 w-8 items-center justify-center rounded-lg font-display text-sm font-bold text-primary-foreground shadow-glow"
      >
        M
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-chrome-foreground">MesaFlow</span>
    </Link>
  );
}

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
              "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-white/10 text-chrome-foreground"
                : "text-chrome-muted-foreground hover:bg-white/5 hover:text-chrome-foreground",
            )}
          >
            {active && (
              <span
                aria-hidden
                className="absolute -left-3 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-chrome-active"
              />
            )}
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
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
      <aside className="hidden w-64 shrink-0 flex-col border-r border-chrome-border bg-chrome md:flex">
        <BrandMark />
        <NavLinks />
        <div className="border-t border-chrome-border px-6 py-4 text-xs text-chrome-muted-foreground">
          MesaFlow © {new Date().getFullYear()}
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label="Fechar menu"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-chrome shadow-lg animate-fade-in">
            <div className="flex items-center justify-between">
              <BrandMark />
              <button
                aria-label="Fechar menu"
                onClick={() => setMobileNavOpen(false)}
                className="mr-4 text-chrome-muted-foreground hover:text-chrome-foreground"
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
