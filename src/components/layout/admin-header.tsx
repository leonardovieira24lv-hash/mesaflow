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
    <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-4 md:px-6">
      <button
        aria-label="Abrir menu"
        onClick={() => setMobileNavOpen(true)}
        className="text-muted-foreground hover:text-foreground md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden text-sm text-muted-foreground md:block">Restaurante</div>

      <div className="flex items-center gap-3">
        {userEmail && <span className="hidden text-sm text-muted-foreground sm:inline">{userEmail}</span>}
        <LogoutButton />
      </div>
    </header>
  );
}
