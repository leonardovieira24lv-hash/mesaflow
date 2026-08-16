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
  // Fase 3 — Gestão de Equipe (2026-08-09): `ownerOnly` — só aparece pra
  // quem tem `role = 'owner'` (ver `AdminSidebar`, abaixo). Cardápio
  // continua visível pra `staff` (tem leitura liberada, só a escrita virou
  // `requireOwner()` nos Route Handlers) — não é um item `ownerOnly`.
  { href: ROUTES.configuracoes, label: "Configurações", icon: Settings, ownerOnly: true },
] as const;

/**
 * Logo real da marca (2026-08-11) — `public/logo-forko.png`, ícone +
 * wordmark já combinados numa imagem só (não é mais badge+texto
 * separados). `<img>` nativo, não `next/image`: mesmo raciocínio já usado
 * na logo do restaurante no Cardápio Público — a altura é fixa (`h-8`,
 * 32px — passou por `h-10`→`h-12`(48px, sobrepôs o botão X de fechar no
 * menu mobile, confirmado por captura de tela real) até chegar aqui).
 * `max-w-full` como trava contra estouro. A largura segue a proporção real do arquivo (`w-auto`), então não
 * precisa de `width`/`height` fixos que o `next/image` exigiria.
 * `alt="Forko"` garante que o nome continue acessível a leitor de tela
 * mesmo sem nenhum texto visível ao lado.
 */
function BrandMark() {
  return (
    <Link href={ROUTES.dashboard} className="flex items-center justify-center px-6 py-6">
      {/* eslint-disable-next-line @next/next/no-img-element -- proporção real do arquivo, ver docstring acima. */}
      <img src="/logo-forko.png" alt="Forko" className="h-8 w-auto max-w-full" />
    </Link>
  );
}

/**
 * Item ativo usa `ds2-primary`/`ds2-primary/10` — nunca dourado. Foco
 * visível nativo, mesmo padrão de anel usado no `Button`.
 *
 * Fase 3 — Gestão de Equipe (2026-08-09): `items` já vem filtrado por quem
 * chama (`AdminSidebar`, abaixo) — "Configurações" só aparece pra `owner`.
 * Isto é só a interface; a proteção real está em `requireOwner()`
 * (`GET/PATCH /api/v1/restaurant`) e no redirect de `configuracoes/page.tsx`
 * — esconder o link aqui não substitui nenhum dos dois.
 *
 * Sprint "Responsividade Desktop — Sidebar Compacta" (2026-08-16):
 * `compact` — nova variante em quadros (ícone em cima, nome pequeno
 * embaixo, empilhado verticalmente), usada SÓ na sidebar de desktop
 * (`<aside>`, abaixo). O drawer mobile continua chamando `<NavLinks>`
 * sem essa prop — nenhuma mudança lá, layout mobile intocado de
 * propósito (regra do projeto: essa etapa é só desktop).
 */
function NavLinks({
  items,
  onNavigate,
  compact,
}: {
  items: (typeof NAV_ITEMS)[number][];
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-1 flex-col", compact ? "gap-1.5 px-2.5" : "gap-1 px-3")}>
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);

        if (compact) {
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 rounded-ds2-sm py-2.5 text-center text-[11px] font-medium leading-none transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds2-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ds2-background",
                active
                  ? "bg-ds2-primary/10 text-ds2-foreground"
                  : "text-ds2-foreground-muted hover:bg-ds2-primary/5 hover:text-ds2-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active && "text-ds2-primary")} aria-hidden />
              {label}
            </Link>
          );
        }

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

/**
 * Sidebar de navegação: chrome escuro fixo em telas médias+, drawer deslizante em mobile.
 *
 * Fase 3 — Gestão de Equipe (2026-08-09): `isOwner` (repassado por
 * `(admin)/layout.tsx`, a partir de `profile.role`) filtra os itens
 * `ownerOnly` antes de renderizar — hoje só "Configurações".
 */
export function AdminSidebar({ isOwner }: { isOwner: boolean }) {
  const { mobileNavOpen, setMobileNavOpen } = useAdminShell();
  const items = NAV_ITEMS.filter((item) => !("ownerOnly" in item && item.ownerOnly) || isOwner);

  return (
    <>
      {/* Desktop / tablet — Sprint "Responsividade Desktop — Sidebar
          Compacta" (2026-08-16): mais estreita (w-64→w-24) e sem o
          `<BrandMark>` (logo Forko), a pedido do dono — os quadros de
          navegação já ocupam esse espaço agora. O drawer mobile (abaixo)
          NÃO foi tocado, mantém `<BrandMark>` e o layout de sempre. */}
      <aside className="hidden w-24 shrink-0 flex-col border-r border-ds2-border bg-ds2-background md:flex">
        <NavLinks items={items} compact />
        <div className="border-t border-ds2-border px-2 py-3 text-center text-[9px] leading-tight text-ds2-foreground-muted">
          Forko © {new Date().getFullYear()}
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
            <div className="relative flex items-center">
              <div className="flex flex-1 justify-center pr-11">
                <BrandMark />
              </div>
              <button
                aria-label="Fechar menu"
                onClick={() => setMobileNavOpen(false)}
                className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-ds2-sm text-ds2-foreground-muted transition-colors hover:bg-ds2-primary/10 hover:text-ds2-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds2-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ds2-background"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks items={items} onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
