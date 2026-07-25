import { Skeleton } from "@/components/ui/skeleton";

/**
 * Estado de carregamento do cardápio do cliente. A página é um Server
 * Component que resolve restaurante, mesa e cardápio direto no Supabase
 * antes de renderizar (ver `menu/page.tsx`) — sem este `loading.tsx`, o
 * Next.js não mostra nada até essas consultas terminarem. Espelha a
 * estrutura real da tela (hero, pills de categoria, grid de cards) para que
 * a transição para o conteúdo carregado não salte — igual ao efeito usado
 * em apps de delivery de referência.
 */
export default function CardapioClienteLoading() {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col pb-24 sm:border-x sm:border-border sm:shadow-card">
      <div className="bg-gradient-to-br from-primary to-[hsl(var(--primary-deep))] px-5 pb-7 pt-9">
        <Skeleton className="h-3 w-28 bg-white/20" />
        <Skeleton className="mt-3 h-8 w-48 bg-white/20" />
      </div>

      <div className="flex gap-2 border-b border-border px-4 py-3">
        {["w-20", "w-24", "w-16", "w-20"].map((widthClass, i) => (
          <Skeleton key={i} className={`h-8 ${widthClass} shrink-0 rounded-full`} />
        ))}
      </div>

      <div className="flex flex-col gap-8 px-4 py-6">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-32" />
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-border p-2.5">
                <Skeleton className="h-28 w-28 shrink-0 rounded-xl" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="mt-1 h-5 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
