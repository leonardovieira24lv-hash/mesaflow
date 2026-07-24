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
    <Link href={ROUTES.dashboard} className="flex items-center gap-2 px-6 py-5">
      <span
        aria-hidden
        className="flex h-7 w-7 items-center justify-center rounded-md bg-primary font-display text-sm font-semibold text-primary-foreground"
      >
        M
      </span>
      <span className="font-display text-lg font-semibold tracking-tight">MesaFlow</span>
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
              "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {active && (
              <span
                aria-hidden
                className="absolute -left-3 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary"
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

/** Sidebar de navegação: fixa em telas médias+, drawer deslizante em mobile. */
export function AdminSidebar() {
  const { mobileNavOpen, setMobileNavOpen } = useAdminShell();

  return (
    <>
      {/* Desktop / tablet */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <BrandMark />
        <NavLinks />
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label="Fechar menu"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface shadow-lg animate-fade-in">
            <div className="flex items-center justify-between">
              <BrandMark />
              <button
                aria-label="Fechar menu"
                onClick={() => setMobileNavOpen(false)}
                className="mr-4 text-muted-foreground hover:text-foreground"
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
