import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { AppError } from "@/lib/api/errors";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
}

/**
 * Lista os funcionários (`role = 'staff'`) de um restaurante — Fase 3
 * (Gestão de Equipe, 2026-08-09). Usada tanto por `equipe/page.tsx` (carga
 * inicial, Server Component) quanto por `GET /api/v1/team` (refetch depois
 * de adicionar alguém) — mesmo raciocínio de reaproveitamento já usado em
 * `getRestaurantOverview`.
 *
 * Exige o cliente **admin** (service role), não o autenticado comum: a
 * única policy de RLS em `profiles` é `select_own_profile`
 * (`id = auth.uid()`, `0002_auth_policies.sql`) — um owner nunca conseguiria
 * ler os profiles de outros usuários do próprio restaurante pelo cliente
 * autenticado normal. Mesmo padrão de "operação fora do contexto de RLS"
 * já documentado em `lib/supabase/admin.ts`.
 *
 * `profiles` não tem colunas de nome/e-mail (só `id, restaurant_id, role`,
 * `0001_initial_schema.sql`) — por isso o nome vem de
 * `user_metadata.staff_name` (gravado na criação, `POST /api/v1/team`) e o
 * e-mail vem direto de `auth.users` via `admin.auth.admin.getUserById`.
 * Nenhuma coluna nova foi criada só para isso.
 */
export async function getTeamMembers(
  admin: SupabaseClient<Database>,
  restaurantId: string,
): Promise<TeamMember[]> {
  const { data: staffProfiles, error } = await admin
    .from("profiles")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("role", "staff");

  if (error || !staffProfiles) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível carregar a equipe.");
  }

  const members = await Promise.all(
    staffProfiles.map(async (staffProfile): Promise<TeamMember> => {
      const { data: userData } = await admin.auth.admin.getUserById(staffProfile.id);
      const metadata = userData.user?.user_metadata as { staff_name?: string } | undefined;

      return {
        id: staffProfile.id,
        name: metadata?.staff_name ?? "",
        email: userData.user?.email ?? "",
      };
    }),
  );

  return members;
}
