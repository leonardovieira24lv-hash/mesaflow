import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiCreated } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { createRestaurantSchema } from "@/lib/validations/onboarding";
import { slugify, nextSlugCandidate } from "@/lib/slug";

// POST /api/v1/onboarding/restaurant — contrato seção 2.1
//
// Cria, em sequência: (1) o usuário no Supabase Auth, (2) o restaurante +
// profile (via função transacional `create_restaurant_with_owner`), e (3)
// uma sessão para o usuário recém-criado. Como (1) é uma chamada de API
// separada da transação de (2), qualquer falha depois de criar o usuário
// aciona uma compensação manual (exclui o usuário) para não deixar uma
// conta "órfã" sem restaurante.
const MAX_SLUG_ATTEMPTS = 5;

export async function POST(request: Request) {
  const admin = createAdminClient();
  let createdUserId: string | null = null;

  try {
    const body = await request.json();
    const input = parseOrThrow(createRestaurantSchema, body);

    // 1. Cria o usuário no Supabase Auth (service role, sem sessão ainda).
    const { data: userData, error: createUserError } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true, // sem etapa de confirmação de e-mail nesta v1
      user_metadata: { owner_name: input.owner_name },
    });
    if (createUserError) {
      const message = createUserError.message.toLowerCase();

      console.error("SUPABASE AUTH ERROR:", createUserError);

      if (message.includes("already been registered") || message.includes("already exists")) {
        throw new AppError("CONFLICT", "Este e-mail já está cadastrado.");
      }

      throw new AppError("VALIDATION_ERROR", createUserError.message);
    }

    createdUserId = userData.user.id;

    // 2. Cria restaurante + profile numa transação só, com retentativa de
    // slug em caso de conflito de unicidade (23505).
    const baseSlug = slugify(input.restaurant_name) || "restaurante";
    let restaurant: { id: string; name: string; slug: string; status: string } | null = null;
    let lastError: { code?: string; message: string } | null = null;

    for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
      const candidateSlug = nextSlugCandidate(baseSlug, attempt);
      const { data, error } = await admin.rpc("create_restaurant_with_owner", {
        p_user_id: createdUserId,
        p_restaurant_name: input.restaurant_name,
        p_slug: candidateSlug,
      });

      if (!error) {
        restaurant = data;
        break;
      }

      lastError = error;
      // 23505 = unique_violation — só faz sentido retentar neste caso
      // específico (conflito de slug); qualquer outro erro é definitivo.
      if (error.code !== "23505") break;
    }

    if (!restaurant) {
      throw new AppError(
        "INTERNAL_ERROR",
        lastError?.message ?? "Não foi possível criar o restaurante. Tente novamente.",
      );
    }

    // 3. Autentica o usuário recém-criado para devolver uma sessão já pronta
    // (contrato seção 2.1) — evita pedir login logo depois do cadastro.
    const anonClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (signInError || !signInData.session) {
      throw new AppError("INTERNAL_ERROR", "Conta criada, mas não foi possível iniciar a sessão.");
    }

    return apiCreated({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        status: restaurant.status,
      },
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
      },
    });
  } catch (err) {
    // Compensação: se o usuário Auth foi criado mas alguma etapa seguinte
    // falhou, remove o usuário para não deixar conta órfã sem restaurante
    // (exceto em caso de e-mail duplicado, onde nenhum usuário novo existe).
    if (createdUserId && !(err instanceof AppError && err.code === "CONFLICT")) {
      await admin.auth.admin.deleteUser(createdUserId).catch(() => {
        // Melhor esforço — se a limpeza falhar, fica um usuário órfão que
        // precisa de intervenção manual, mas não mascaramos o erro original.
      });
    }
    return handleRouteError(err);
  }
}
