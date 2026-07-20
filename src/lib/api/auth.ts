import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/api/errors";
import type { Profile } from "@/types/domain";

/**
 * Resolve o usuário autenticado e seu `restaurant_id` a partir da sessão
 * atual (cookies), consultando `profiles`. Lança `401 UNAUTHORIZED` se não
 * houver sessão válida ou se a sessão não tiver um perfil associado ainda
 * (ex.: onboarding — seção 2 do contrato — não concluído; esse fluxo em si
 * é implementado em outra sprint, mas o guard já cobre o caso).
 *
 * Todo Route Handler administrativo (fora de `/api/v1/public/...`) deve
 * chamar isto antes de tocar no banco — é a segunda camada de segurança
 * descrita na seção 1.6 do contrato (a primeira é o RLS).
 */
export async function requireSession(): Promise<{ userId: string; profile: Profile }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("UNAUTHORIZED", "Sessão ausente ou expirada. Faça login novamente.");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, restaurant_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível verificar sua sessão. Tente novamente.");
  }

  if (!profile) {
    throw new AppError(
      "UNAUTHORIZED",
      "Sua conta ainda não está associada a um restaurante. Conclua o onboarding.",
    );
  }

  return {
    userId: user.id,
    profile: {
      id: profile.id,
      restaurantId: profile.restaurant_id,
      role: profile.role,
    },
  };
}

/** Igual a `requireSession`, mas também exige `role = "owner"` (seção 4.2). */
export async function requireOwner(): Promise<{ userId: string; profile: Profile }> {
  const session = await requireSession();

  if (session.profile.role !== "owner") {
    throw new AppError("FORBIDDEN", "Apenas o proprietário do restaurante pode executar esta ação.");
  }

  return session;
}
