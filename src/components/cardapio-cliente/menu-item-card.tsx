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
 * Card de produto (Fase 3, item 4/5: listagem e organização visual dos
 * produtos).
 *
 * Sprint "Redesign Premium do Cardápio" (2026-07-28): reformulação completa
 * do card, de linha horizontal (foto pequena à esquerda) para cartão
 * vertical com a foto grande no topo — a foto volta a ser o maior destaque
 * visual, na linha dos melhores apps de delivery. Isso inverte
 * deliberadamente a decisão da sprint anterior de encolher a foto para
 * priorizar densidade (mais itens visíveis sem scroll); a troca aqui é
 * consciente: menos itens por tela, mais apelo comercial por item. Nenhuma
 * lógica de seleção/carrinho foi alterada — `onSelect` continua abrindo o
 * mesmo `<ProductDetailModal>` de sempre.
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
        "group flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-card transition-[border-color,box-shadow,transform] duration-200",
        isAvailable
          ? "hover:-translate-y-1 hover:border-primary/30 hover:shadow-card-hover active:translate-y-0 active:scale-[0.98] active:shadow-card"
          : "cursor-not-allowed opacity-60",
      )}
    >
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-muted">
        {item.image_url ? (
          <>
            {!imageLoaded && <div className="skeleton-shimmer absolute inset-0 z-10 animate-shimmer" aria-hidden />}
            <Image
              src={item.image_url}
              alt=""
              fill
              sizes="(min-width: 640px) 280px, 50vw"
              onLoad={() => setImageLoaded(true)}
              className={cn(
                "object-cover transition-[opacity,transform] duration-300",
                isAvailable && "group-hover:scale-[1.06]",
                imageLoaded ? "opacity-100" : "opacity-0",
              )}
            />
          </>
        ) : (
          // Placeholder elegante em vez de um retângulo cinza vazio: um
          // círculo com o tom de marca sobre um degradê suave — comunica
          // "prato sem foto ainda", não "algo quebrou".
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/[0.08] via-muted to-muted">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface shadow-card">
              <UtensilsCrossed className="h-5 w-5 text-primary/60" aria-hidden />
            </div>
          </div>
        )}

        {!isAvailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/70 backdrop-blur-[1px]">
            <Badge variant="muted">Indisponível</Badge>
          </div>
        )}

        {isAvailable && (
          <span
            aria-hidden
            className="btn-primary-surface absolute bottom-2.5 right-2.5 flex h-10 w-10 items-center justify-center rounded-full text-primary-foreground shadow-glow transition-transform duration-200 ease-out group-hover:scale-110 group-active:scale-90"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 px-3.5 pb-3.5 pt-3">
        <p className="line-clamp-1 font-display text-[15px] font-semibold leading-tight text-foreground">
          {item.name}
        </p>
        {item.description && (
          <p className="line-clamp-2 text-[12px] leading-snug text-muted-foreground">{item.description}</p>
        )}
        <span className="mt-1.5 font-numeric text-base font-bold tabular-nums text-primary">
          {formatCurrency(item.price)}
        </span>
      </div>
    </button>
  );
}
