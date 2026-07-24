import type { LucideIcon } from "lucide-react";
import type { Route } from "next";
import { UtensilsCrossed, Package, LayoutGrid, QrCode, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { ROUTES } from "@/constants/routes";

interface QuickAction {
  label: string;
  // `Route`, não `string`: com `typedRoutes` (next.config.mjs), `<Link href>`
  // exige uma rota conhecida em tempo de compilação. Declarar este campo como
  // `string` widening o literal de `ROUTES.*` (que é `as const`) de volta
  // para `string` genérico, e o build falha em "Type 'string' is not
  // assignable to type '...Route...'".
  href: Route;
  icon: LucideIcon;
}

const ACTIONS: QuickAction[] = [
  { label: "Categorias", href: ROUTES.cardapioCategorias, icon: UtensilsCrossed },
  { label: "Produtos", href: ROUTES.cardapioProdutos, icon: Package },
  { label: "Mesas", href: ROUTES.mesas, icon: LayoutGrid },
  // QR Codes são gerenciados dentro da tela de Mesas (mesmo módulo, seção 7
  // do contrato) — sem tela própria ainda, por isso aponta para a mesma rota.
  { label: "QR Codes", href: ROUTES.mesas, icon: QrCode },
];

/**
 * Atalhos para os módulos de negócio do painel. Categorias e Produtos já
 * levam às telas reais implementadas na Sprint 6; Mesas/QR Codes ainda
 * apontam para a página placeholder (módulo pendente, seção 7 do contrato).
 */
export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {ACTIONS.map(({ label, href, icon: Icon }) => (
        <Link key={label} href={href} className="group">
          <Card interactive className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-transform group-hover:scale-110">
              <Icon className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <span className="flex-1 text-sm font-medium">{label}</span>
            <ArrowUpRight
              className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden
            />
          </Card>
        </Link>
      ))}
    </div>
  );
}
