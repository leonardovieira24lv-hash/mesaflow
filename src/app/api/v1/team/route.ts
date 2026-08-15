import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/api/auth";
import { apiSuccess, apiCreated } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { assertWithinRateLimit } from "@/lib/api/rate-limit";
import { createStaffSchema } from "@/lib/validations/team";
import { getTeamMembers } from "@/lib/team/get-team-members";

// GET /api/v1/team — Fase 3 (Gestão de Equipe, 2026-08-09).
//
// Lista os funcionários (`role = 'staff'`) do restaurante do owner
// autenticado. `requireOwner()` — staff não gerencia equipe (nem lista os
// colegas), só o próprio dono.
export async function GET() {
  try {
    const { profile } = await requireOwner();
    const admin = createAdminClient();
    const team = await getTeamMembers(admin, profile.restaurantId);

    return apiSuccess(team);
  } catch (err) {
    return handleRouteError(err);
  }
}

// Mesmo raciocínio de `onboarding/restaurant/route.ts`: este endpoint
// também chama `admin.auth.admin.createUser` diretamente — sem rate limit
// próprio, seria possível criar contas sem limite algum.
const STAFF_CREATE_RATE_LIMIT = { limit: 10, windowMs: 60 * 60_000 };

// POST /api/v1/team — Fase 3 (Gestão de Equipe, 2026-08-09).
//
// Cria um funcionário (`role = 'staff'`) vinculado ao restaurante do owner
// autenticado. Mesmo padrão de duas etapas de `onboarding/restaurant/route.ts`
// (Auth Admin API cria o usuário → insere o profile), incluindo a mesma
// compensação em caso de falha parcial — a diferença é que aqui não existe
// uma função RPC transacional como `create_restaurant_with_owner`: só
// UMA linha nova em `profiles` (não duas tabelas relacionadas como no
// onboarding), então uma inserção direta via cliente admin já é suficiente
// e segura, sem precisar de uma função Postgres nova.
//
// `restaurant_id` e `role` NUNCA vêm do corpo da requisição — `restaurant_id`
// é sempre `profile.restaurantId` (derivado da sessão do owner autenticado
// por `requireOwner()`), `role` é sempre a string literal `"staff"`. Não há
// nenhum campo no schema de validação (`createStaffSchema`) que aceite
// nenhum dos dois — a única forma de alterar isso seria mudar este arquivo.
export async function POST(request: Request) {
  const admin = createAdminClient();
  let createdUserId: string | null = null;

  try {
    const { profile } = await requireOwner();
    await assertWithinRateLimit(`team-create:${profile.restaurantId}`, STAFF_CREATE_RATE_LIMIT);

    const body = await request.json();
    const input = parseOrThrow(createStaffSchema, body);

    // 1. Cria o usuário no Supabase Auth (service role, sem sessão própria
    // — quem loga com essas credenciais depois é o próprio funcionário).
    const { data: userData, error: createUserError } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { staff_name: input.name },
    });

    if (createUserError) {
      const message = createUserError.message.toLowerCase();

      if (message.includes("already been registered") || message.includes("already exists")) {
        throw new AppError("CONFLICT", "Este e-mail já está cadastrado.");
      }

      throw new AppError("VALIDATION_ERROR", createUserError.message);
    }

    createdUserId = userData.user.id;

    // 2. Vincula o novo usuário ao restaurante do owner autenticado, como
    // staff. Inserção direta via cliente admin (ignora RLS por definição —
    // não é necessária nenhuma policy de INSERT nova em `profiles` para
    // isto, mesma conclusão da auditoria da Fase 3).
    const { error: profileError } = await admin.from("profiles").insert({
      id: createdUserId,
      restaurant_id: profile.restaurantId,
      role: "staff",
    });

    if (profileError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível vincular o funcionário ao restaurante.");
    }

    return apiCreated({ id: createdUserId, name: input.name, email: input.email });
  } catch (err) {
    // Compensação: se o usuário Auth foi criado mas o vínculo com o
    // restaurante falhou, remove o usuário para não deixar conta órfã sem
    // profile — mesmo padrão de `onboarding/restaurant/route.ts`.
    if (createdUserId) {
      await admin.auth.admin.deleteUser(createdUserId).catch(() => {
        // Melhor esforço — se a limpeza falhar, fica um usuário órfão que
        // precisa de intervenção manual, mas não mascaramos o erro original.
      });
    }
    return handleRouteError(err);
  }
}
