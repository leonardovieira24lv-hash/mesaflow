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
 */
export function AdminHeader({ userEmail }: AdminHeaderProps) {
  const { setMobileNavOpen } = useAdminShell();

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-surface/80 px-4 backdrop-blur-sm md:px-8">
      <button
        aria-label="Abrir menu"
        onClick={() => setMobileNavOpen(true)}
        className="text-muted-foreground hover:text-foreground md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden text-sm font-medium text-muted-foreground md:block">Painel do restaurante</div>

      <div className="flex items-center gap-3">
        {userEmail && (
          <span className="hidden rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground sm:inline">
            {userEmail}
          </span>
        )}
        <LogoutButton />
      </div>
    </header>
  );
}
