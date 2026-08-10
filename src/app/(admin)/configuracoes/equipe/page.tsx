import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/auth/require-page-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeamMembers } from "@/lib/team/get-team-members";
import { TeamManager } from "@/components/configuracoes/team-manager";
import { ROUTES } from "@/constants/routes";

export const metadata = { title: "Equipe" };

/**
 * Gestão de Equipe (Fase 3, 2026-08-09) — só `owner`. `requirePageSession()`
 * garante sessão+profile válidos (mesma proteção de toda página sob
 * `(admin)`); o `redirect` abaixo é a checagem adicional de `role`,
 * mesmo padrão que o próprio `configuracoes/page.tsx` passa a ter nesta
 * Sprint. Reforça (não substitui) a proteção real, que é o `requireOwner()`
 * em `GET/POST /api/v1/team`.
 */
export default async function EquipePage() {
  const { profile } = await requirePageSession();
  if (profile.role !== "owner") {
    redirect(ROUTES.dashboard);
  }

  const admin = createAdminClient();
  const team = await getTeamMembers(admin, profile.restaurantId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold">Equipe</h1>
        <p className="text-sm text-muted-foreground">Gerencie os funcionários com acesso ao sistema.</p>
      </div>

      <TeamManager initialTeam={team} />
    </div>
  );
}
