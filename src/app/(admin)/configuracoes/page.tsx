import { redirect } from "next/navigation";
import Link from "next/link";
import { Store, Clock, Users, Printer, ChevronRight } from "lucide-react";
import { requirePageSession } from "@/lib/auth/require-page-session";
import { ROUTES } from "@/constants/routes";

export const metadata = { title: "Configurações" };

const OPTIONS = [
  {
    href: ROUTES.configuracoesPerfil,
    icon: Store,
    title: "Perfil",
    description: "Identidade, contato e endereço do restaurante.",
  },
  {
    href: ROUTES.configuracoesOperacao,
    icon: Clock,
    title: "Operação",
    description: "Horário de funcionamento e formas de pagamento aceitas.",
  },
  {
    href: ROUTES.configuracoesEquipe,
    icon: Users,
    title: "Equipe",
    description: "Funcionários com acesso ao sistema.",
  },
  {
    href: ROUTES.configuracoesImpressao,
    icon: Printer,
    title: "Impressão",
    description: "Conecte o computador do restaurante para imprimir pedidos.",
  },
] as const;

/**
 * Configurações — hub (2026-08-15). Antes, `/configuracoes` já ERA o
 * Perfil do Restaurante (formulário inteiro direto na tela), com
 * "Operação"/"Equipe" como 2 atalhos pendurados no topo — visualmente
 * desequilibrado ("2 botões + um monte de cards soltos embaixo"),
 * relatado pelo dono com prints. Mockup aprovado antes de codar (regra
 * do projeto): virou um hub simples, 3 opções simétricas
 * (Perfil/Operação/Equipe), cada uma sua própria página — o conteúdo do
 * Perfil não mudou em nada, só passou a morar em
 * `/configuracoes/perfil` (ver esse arquivo pro histórico completo).
 *
 * Sem busca de dado nenhuma aqui de propósito — é só navegação, carrega
 * mais rápido que a versão antiga (que já buscava `getRestaurantOverview`
 * só pra mostrar 2 botões).
 */
export default async function ConfiguracoesPage() {
  const { profile } = await requirePageSession();
  if (profile.role !== "owner") {
    redirect(`${ROUTES.dashboard}?blocked=configuracoes`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold text-ds2-foreground">Configurações</h1>
        <p className="text-sm text-ds2-foreground-muted">Escolha o que você quer gerenciar.</p>
      </div>

      <div className="flex flex-col gap-3">
        {OPTIONS.map((option) => (
          <Link
            key={option.href}
            href={option.href}
            className="flex items-center gap-4 rounded-ds2-lg border border-ds2-border bg-ds2-surface p-4 transition hover:bg-ds2-surface-hover active:scale-[0.98]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-ds2-md bg-ds2-primary/10 text-ds2-primary">
              <option.icon className="h-5 w-5" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold text-ds2-foreground">{option.title}</span>
              <span className="text-xs text-ds2-foreground-muted">{option.description}</span>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-ds2-foreground-muted" aria-hidden />
          </Link>
        ))}
      </div>
    </div>
  );
}
