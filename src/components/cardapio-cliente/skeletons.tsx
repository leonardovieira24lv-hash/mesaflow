import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeletons do fluxo do cliente — um componente por tela, reutilizado tanto
 * pelo `loading.tsx` de cada rota (Suspense automático do Next.js) quanto
 * por qualquer lugar futuro que precise do mesmo placeholder.
 *
 * Extraído dos `loading.tsx` individuais (Sprint "UX e Fluxo do Cliente",
 * observação do dono após a primeira entrega): antes, as mesmas dimensões
 * (header compacto, foto de produto 80px, etc.) estavam copiadas em 3-5
 * arquivos diferentes — se o layout real mudar de novo no futuro, dava pra
 * esquecer de atualizar algum e reintroduzir o mesmo salto de layout que
 * essa sprint corrigiu. Agora é um componente só por tela; muda aqui, muda
 * em todo lugar que usa.
 *
 * O cabeçalho compacto (`RestaurantHeaderSkeleton`) é comum às quatro —
 * mesmas dimensões de `restaurant-header.tsx` — então fica isolado também,
 * em vez de repetido dentro de cada skeleton de tela. Aceita `withSearch`
 * (Sprint "Redesign Premium do Cardápio", 2026-07-28) porque só a tela do
 * Cardápio ganhou a barra de busca — Carrinho/Checkout/Acompanhamento
 * continuam com o cabeçalho compacto de sempre, sem essa linha extra.
 *
 * Sprint "Refinamento Premium do Cardápio" (2026-07-28, seguinte): cores
 * do skeleton do cabeçalho passaram de branco-sobre-verde para
 * cinza-sobre-branco, acompanhando o novo fundo neutro de
 * `restaurant-header.tsx` — evita um flash verde→branco entre o loading e
 * o conteúdo real.
 */
function RestaurantHeaderSkeleton({ withSearch = false }: { withSearch?: boolean }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border bg-surface px-4 pb-3.5 pt-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
      </div>
      {withSearch && <Skeleton className="h-10 w-full rounded-full" />}
    </div>
  );
}

/** Skeleton do Cardápio (`/{slug}/menu`) — espelha `RestaurantHeader` + `CategoryNav` + `MenuItemCard`. */
export function MenuSkeleton() {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col pb-24 sm:border-x sm:border-border sm:shadow-card">
      <RestaurantHeaderSkeleton withSearch />

      <div className="flex gap-2 border-b border-border px-4 py-3">
        {["w-16", "w-20", "w-14", "w-16"].map((widthClass, i) => (
          <Skeleton key={i} className={`h-9 ${widthClass} shrink-0 rounded-full`} />
        ))}
      </div>

      <div className="flex flex-col gap-7 px-4 py-5">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-28" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col overflow-hidden rounded-2xl border border-border/70">
                <Skeleton className="aspect-[4/5] w-full rounded-none" />
                <div className="flex flex-col gap-1.5 px-3.5 pb-3.5 pt-4">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="mt-1 h-4 w-1/3 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Skeleton do Carrinho (`/{slug}/carrinho`) — espelha `carrinho-view.tsx`. */
export function CartSkeleton() {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col pb-8 sm:border-x sm:border-border sm:shadow-card">
      <RestaurantHeaderSkeleton />

      <div className="flex items-center justify-between px-4 pt-4">
        <Skeleton className="h-8 w-36" />
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        <Skeleton className="h-6 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl border border-border p-3">
            <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton do Checkout (`/{slug}/checkout`) — espelha `checkout-view.tsx`. */
export function CheckoutSkeleton() {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col pb-8 sm:border-x sm:border-border sm:shadow-card">
      <RestaurantHeaderSkeleton />

      <div className="px-4 pt-4">
        <Skeleton className="h-8 w-32" />
      </div>

      <div className="flex flex-col gap-5 px-4 py-4">
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

/** Skeleton do Acompanhamento do Pedido (`/{slug}/orders/{orderId}`) — espelha `order-tracking-view.tsx`. */
export function OrderTrackingSkeleton() {
  return (
    <div className="flex min-h-screen flex-col">
      <RestaurantHeaderSkeleton />

      <main className="flex flex-1 flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-8 shrink-0 rounded-full" />
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-16" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
