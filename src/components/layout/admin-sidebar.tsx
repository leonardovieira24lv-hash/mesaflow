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
 * `compact` — variante em quadros (ícone em cima, nome pequeno embaixo,
 * empilhado verticalmente). Usada na sidebar de desktop (`<aside>`,
 * abaixo) e também no drawer mobile — extensão pedida pelo dono no
 * mesmo dia ("tem que refletir no celular, fica estranho ficar
 * diferente"), depois de ver os dois lados com visual diferente.
 */
function NavLinks({
  items,
  onNavigate,
  compact,
  compactLarge,
}: {
  items: (typeof NAV_ITEMS)[number][];
  onNavigate?: () => void;
  compact?: boolean;
  /**
   * Sprint "Sidebar Compacta — ajuste do mobile" (2026-08-16): o dono
   * achou o `compact` original pequeno demais na gaveta mobile (depois
   * de já ter testado espaço vazio demais numa versão anterior, e
   * grade de 2 colunas numa versão intermediária — nenhuma agradou).
   * `compactLarge` é só um reforço de tamanho (ícone/texto maiores) em
   * cima do MESMO layout de 1 coluna do `compact` — usado só no drawer
   * mobile (abaixo). Desktop continua com `compact` sem isso, do jeito
   * que já foi aprovado antes.
   */
  compactLarge?: boolean;
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
                "flex flex-col items-center rounded-ds2-sm text-center font-medium leading-none transition-colors duration-150",
                compactLarge ? "gap-1.5 py-3 text-[13px]" : "gap-1 py-2.5 text-[11px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds2-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ds2-background",
                active
                  ? "bg-ds2-primary/10 text-ds2-foreground"
                  : "text-ds2-foreground-muted hover:bg-ds2-primary/5 hover:text-ds2-foreground",
              )}
            >
              <Icon
                className={cn("shrink-0", compactLarge ? "h-6 w-6" : "h-4 w-4", active && "text-ds2-primary")}
                aria-hidden
              />
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
          recebeu o mesmo tratamento (ver comentário lá). */}
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
          {/* Sprint "Responsividade Desktop — Sidebar Compacta", extensão
              pro mobile (2026-08-16, pedido do dono: "tem que refletir no
              celular, fica estranho ficar diferente"). Mesmo tratamento
              do `<aside>` de desktop — sem `<BrandMark>`, `NavLinks`
              compact — só que aqui como drawer (desliza da esquerda),
              não fixo na tela.
              Passou por 3 ajustes de tamanho no mesmo dia até o dono
              aprovar: v1 (w-48, mesmo tamanho do desktop) achou "não
              ficou legal"; v2 (grade 2 colunas) não era o que ele queria
              ("mesma linha do desktop, em linha" = 1 coluna); v3 (w-32,
              ícone/texto reduzidos) achou "pequeno ainda"; v4 (esta,
              w-44, ícone h-6/texto 13px via `compactLarge`) foi a
              aprovada. */}
          <div className="absolute inset-y-0 left-0 flex w-44 flex-col bg-ds2-background shadow-ds2-lg animate-slide-in-right">
            <div className="flex items-center justify-between p-2">
              {/* Correção (2026-08-16): o comentário acima dizia que o
                  símbolo "já morava" aqui, mas isso nunca foi
                  implementado de verdade — só o botão de fechar existia.
                  Adicionado agora, mesma imagem real usada no
                  `AdminHeader` do desktop (`/logo-forko-icon.png`). */}
              <img src="/logo-forko-icon.png" alt="Forko" className="ml-1.5 h-6 w-auto shrink-0" />
              <button
                aria-label="Fechar menu"
                onClick={() => setMobileNavOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-ds2-sm text-ds2-foreground-muted transition-colors hover:bg-ds2-primary/10 hover:text-ds2-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds2-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ds2-background"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks items={items} onNavigate={() => setMobileNavOpen(false)} compact compactLarge />
          </div>
        </div>
      )}
    </>
  );
}
