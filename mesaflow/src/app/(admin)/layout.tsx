import { requirePageSession } from "@/lib/auth/require-page-session";
import { AdminShellProvider } from "@/components/layout/admin-shell-context";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminHeader } from "@/components/layout/admin-header";

/**
 * Shell do painel administrativo, compartilhado por todas as telas sob
 * `(admin)`: Dashboard, Pedidos, Cardápio, Mesas e Configurações.
 *
 * `requirePageSession()` é a proteção de sessão/perfil ao nível de página
 * (complementar ao `middleware.ts`, que já redireciona antes disso rodar).
 * Como é envolvida em `cache()`, páginas filhas (ex.: o Dashboard) podem
 * chamá-la de novo sem custo extra de consulta ao banco no mesmo request.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requirePageSession();

  return (
    <AdminShellProvider>
      <div className="flex min-h-screen">
        <AdminSidebar />
        <div className="flex flex-1 flex-col">
          <AdminHeader userEmail={user.email} />
          <main className="flex-1 bg-muted/30 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </AdminShellProvider>
  );
}
