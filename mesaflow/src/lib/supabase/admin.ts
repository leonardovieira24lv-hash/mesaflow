import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Cliente Supabase com a **service role key** — ignora RLS.
 *
 * Uso restrito a fluxos server-side que precisam operar fora do contexto de
 * um usuário autenticado (ex.: onboarding, seção 2.1, que cria o `auth.user`
 * antes de qualquer sessão existir). Nunca importar este arquivo em um
 * Client Component nem expor `SUPABASE_SERVICE_ROLE_KEY` ao bundle do cliente.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
