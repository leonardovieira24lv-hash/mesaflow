import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/domain";

/**
 * Equivalente a `requireSession()` (lib/api/auth.ts), mas para **Server
 * Components de página**, não Route Handlers: em vez de lançar `AppError`
 * (que só faz sentido dentro do envelope de resposta de uma API),
 * redireciona com `next/navigation`. Toda página sob `(admin)` deve chamar
 * isto (direto ou via um componente pai) em vez de reimplementar a
 * checagem de sessão/perfil.
 *
 * Envolvido em `cache()` do React: se o layout e a página (e componentes
 * filhos) chamarem isto no mesmo request, a consulta a `profiles` roda uma
 * única vez — sem isso, cada chamada bateria no banco de novo.
 */
export const requirePageSession = cache(async (): Promise<{ user: User; profile: Profile }> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, restaurant_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    // Sessão válida, mas onboarding (Sprint 4) nunca foi concluído — não
    // deveria acontecer no fluxo normal (o profile nasce junto com o
    // restaurante), mas serve de rede de segurança.
    redirect("/onboarding/restaurante");
  }

  return {
    user,
    profile: { id: profile.id, restaurantId: profile.restaurant_id, role: profile.role },
  };
});
