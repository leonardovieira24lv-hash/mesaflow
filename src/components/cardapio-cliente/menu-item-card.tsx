import { useState } from "react";
import Image from "next/image";
import { UtensilsCrossed, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { PublicMenuItem } from "@/lib/orders/public-menu";

interface MenuItemCardProps {
  item: PublicMenuItem;
  onSelect: (item: PublicMenuItem) => void;
}

/**
 * Linha de produto (Fase 3, item 4/5: listagem e organização visual dos
 * produtos).
 *
 * v2 (pós-feedback "precisa ter mais presença"): a foto cresceu de 96px
 * para 112px e ganhou uma borda interna sutil (a foto é o que vende o
 * prato — merece mais área do card do que tinha). O preço deixou de ser só
 * texto colorido e virou uma pill com fundo (`bg-primary/10`) — ganha peso
 * próprio em vez de competir com o resto do texto pela mesma hierarquia
 * tipográfica. O "+" cresceu (36px → 40px) e ganha uma leve elevação no
 * hover, não só no toque. Identidade própria, não clonada de nenhuma
 * referência: a pill de preço e o gradiente do botão reaproveitam os
 * tokens de marca já definidos em `globals.css` (`--primary`,
 * `--primary-deep`, `.btn-primary-surface`) — a mesma decisão de marca do
 * hero do cardápio, aplicada aqui com mais intensidade.
 */
export function MenuItemCard({ item, onSelect }: MenuItemCardProps) {
  const isAvailable = item.is_available;
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <button
      type="button"
      disabled={!isAvailable}
      onClick={() => onSelect(item)}
      aria-label={isAvailable ? `Ver detalhes de ${item.name}` : `${item.name} — indisponível no momento`}
      className={cn(
        "group flex w-full items-center gap-3.5 rounded-2xl border border-border bg-surface p-2.5 pr-3.5 text-left shadow-card transition-[border-color,box-shadow,transform] duration-200",
        isAvailable
          ? "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover active:translate-y-0 active:scale-[0.98] active:shadow-card"
          : "cursor-not-allowed opacity-60",
      )}
    >
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl">
        {item.image_url ? (
          <>
            {!imageLoaded && <div className="skeleton-shimmer absolute inset-0 z-10 animate-shimmer" aria-hidden />}
            <Image
              src={item.image_url}
              alt=""
              fill
              sizes="112px"
              onLoad={() => setImageLoaded(true)}
              className={cn(
                "object-cover transition-[opacity,transform] duration-300",
                isAvailable && "group-hover:scale-[1.08]",
                imageLoaded ? "opacity-100" : "opacity-0",
              )}
            />
            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-black/5" aria-hidden />
          </>
        ) : (
          // Placeholder elegante em vez de um retângulo cinza vazio: um
          // círculo com o tom de marca sobre um degradê suave — comunica
          // "prato sem foto ainda", não "algo quebrou".
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/[0.07] via-muted to-muted">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface shadow-card">
              <UtensilsCrossed className="h-5 w-5 text-primary/60" aria-hidden />
            </div>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
        <p className="line-clamp-1 font-display text-[15px] font-semibold leading-tight text-foreground">
          {item.name}
        </p>
        {item.description && (
          <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{item.description}</p>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="rounded-lg bg-primary/10 px-2 py-1 font-numeric text-[15px] font-bold tabular-nums text-primary">
            {formatCurrency(item.price)}
          </span>
          {isAvailable ? (
            <span
              aria-hidden
              className="btn-primary-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary-foreground shadow-glow transition-transform duration-200 group-hover:scale-110 group-active:scale-90"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
            </span>
          ) : (
            <Badge variant="muted" className="shrink-0">
              Indisponível
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}
