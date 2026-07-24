import Image from "next/image";
import { UtensilsCrossed } from "lucide-react";
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
 * produtos). Indisponíveis aparecem desabilitados de verdade — Módulo 1:
 * "produtos indisponíveis devem aparecer desabilitados" — sem `onClick`,
 * com opacidade reduzida e badge, nunca escondidos ou removidos da lista.
 */
export function MenuItemCard({ item, onSelect }: MenuItemCardProps) {
  const isAvailable = item.is_available;

  return (
    <button
      type="button"
      disabled={!isAvailable}
      onClick={() => onSelect(item)}
      aria-label={isAvailable ? `Ver detalhes de ${item.name}` : `${item.name} — indisponível no momento`}
      className={cn(
        "group flex w-full items-center gap-4 rounded-xl border border-border bg-surface p-3 text-left shadow-card transition-[border-color,box-shadow,transform] duration-150",
        isAvailable
          ? "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover active:translate-y-0"
          : "cursor-not-allowed opacity-60",
      )}
    >
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt=""
            fill
            sizes="96px"
            className={cn("object-cover transition-transform duration-300", isAvailable && "group-hover:scale-105")}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <UtensilsCrossed className="h-7 w-7 text-muted-foreground" aria-hidden />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 self-stretch py-0.5">
        <p className="truncate font-display text-base font-medium leading-tight text-foreground">{item.name}</p>
        {item.description && (
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">{item.description}</p>
        )}
        <div className="mt-auto flex items-center gap-2 pt-1">
          <span className="font-mono text-base font-semibold tabular-nums text-primary">
            {formatCurrency(item.price)}
          </span>
          {!isAvailable && <Badge variant="muted">Indisponível</Badge>}
        </div>
      </div>
    </button>
  );
}
