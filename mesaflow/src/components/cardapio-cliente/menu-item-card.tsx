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
 * produtos). Card vertical com a imagem dominando o espaço (referência:
 * apps de delivery) — o clique em qualquer parte do card, incluindo o "+"
 * flutuante, abre o modal de detalhes (mesmo fluxo de sempre, só que com
 * uma chamada visual mais forte para adicionar). Indisponíveis aparecem
 * desabilitados de verdade — Módulo 1: "produtos indisponíveis devem
 * aparecer desabilitados" — sem `onClick`, com opacidade reduzida e badge,
 * nunca escondidos ou removidos da lista.
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
        "group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-card transition-[border-color,box-shadow,transform] duration-150",
        isAvailable
          ? "hover:-translate-y-1 hover:border-primary/30 hover:shadow-card-hover active:translate-y-0 active:scale-[0.97] active:shadow-card"
          : "cursor-not-allowed opacity-60",
      )}
    >
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-muted">
        {item.image_url ? (
          <>
            {!imageLoaded && <div className="skeleton-shimmer absolute inset-0 animate-shimmer" aria-hidden />}
            <Image
              src={item.image_url}
              alt=""
              fill
              sizes="(min-width: 640px) 33vw, 50vw"
              onLoad={() => setImageLoaded(true)}
              className={cn(
                "object-cover transition-[opacity,transform] duration-300",
                isAvailable && "group-hover:scale-105",
                imageLoaded ? "opacity-100" : "opacity-0",
              )}
            />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <UtensilsCrossed className="h-8 w-8 text-muted-foreground" aria-hidden />
          </div>
        )}

        {isAvailable && (
          <span
            aria-hidden
            className="btn-primary-surface absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground shadow-glow transition-transform group-hover:scale-110"
          >
            <Plus className="h-4 w-4" />
          </span>
        )}
        {!isAvailable && (
          <Badge variant="muted" className="absolute bottom-2 right-2">
            Indisponível
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <p className="line-clamp-1 font-display text-sm font-semibold leading-tight text-foreground">{item.name}</p>
        {item.description && (
          <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{item.description}</p>
        )}
        <span className="mt-auto pt-2 font-mono text-base font-bold tabular-nums text-primary">
          {formatCurrency(item.price)}
        </span>
      </div>
    </button>
  );
}
