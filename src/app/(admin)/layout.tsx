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
      {/* `.dark` continua aqui só como infraestrutura do Tailwind
          (variáveis que alguns tokens legados ainda resolvem) — nunca
          substituída. `.ds2-dark` é o tema visual de fato do shell
          administrativo inteiro: Sidebar, Header e `<main>` leem tokens
          `ds2-*` diretamente daqui, na raiz — nenhuma tela precisa de um
          wrapper próprio. Cardápio público, Onboarding e Autenticação
          continuam de fora, no tema claro original. */}
      <div className="dark ds2-dark flex min-h-screen bg-background">
        <AdminSidebar />
        {/* `min-w-0` é a correção real do overflow horizontal no mobile: um
            item flex tem `min-width: auto` por padrão, então sem isso ele
            nunca encolhe abaixo da largura do seu conteúdo mais largo (ex.:
            a tabela de "Últimos pedidos" no Dashboard) — a página inteira
            cresce em vez de deixar esse conteúdo rolar internamente no seu
            próprio `overflow-x-auto`. Sem essa propriedade em nenhum lugar,
            não existe overflow-x mascarado — isso resolve a causa, não o
            sintoma. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminHeader userEmail={user.email} />
          <main className="min-w-0 flex-1 bg-ds2-background p-4 md:p-6">{children}</main>
        </div>
      </div>
    </AdminShellProvider>
  );
}
