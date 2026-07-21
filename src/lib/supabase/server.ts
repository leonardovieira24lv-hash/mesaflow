import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

/**
 * Cliente Supabase para uso em Server Components, Route Handlers e Server
 * Actions. Lê/escreve a sessão a partir dos cookies da requisição atual.
 *
 * Esta é a segunda camada de segurança descrita no contrato (seção 1.6):
 * a primeira é o RLS no Postgres; esta resolve `restaurant_id`/sessão antes
 * mesmo de tocar no banco, permitindo devolver 401/403 cedo.
 */
export async function createClient() {
  // Next.js 14: `cookies()` é síncrono (só passou a retornar uma Promise a
  // partir da API de requisição assíncrona do Next.js 15). A função
  // continua `async` porque todo o projeto já chama `await createClient()`
  // — isso segue funcionando normalmente, só não há mais nada para aguardar
  // aqui dentro.
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // `setAll` chamado a partir de um Server Component: ignorável se
            // houver middleware renovando a sessão (ver `middleware.ts`).
          }
        },
      },
    },
  );
}
