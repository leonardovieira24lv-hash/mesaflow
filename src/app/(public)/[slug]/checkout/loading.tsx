import { Skeleton } from "@/components/ui/skeleton";

/**
 * Estado de carregamento da tela de Checkout — mesmo motivo dos outros dois
 * `loading.tsx` do fluxo do cliente (cardápio, Marco 1; carrinho, Marco 2):
 * a página resolve restaurante e mesa no servidor antes de renderizar.
 */
export default function CheckoutLoading() {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col pb-8 sm:border-x sm:border-border sm:shadow-card">
      <div className="bg-gradient-to-br from-primary to-[hsl(var(--primary-deep))] px-5 pb-7 pt-9">
        <Skeleton className="h-3 w-28 bg-white/20" />
        <Skeleton className="mt-3 h-8 w-48 bg-white/20" />
      </div>

      <div className="px-4 pt-4">
        <Skeleton className="h-8 w-32" />
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl border border-border p-3">
            <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          </div>
        ))}
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    </div>
  );
}
