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
        "flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-3 text-left transition-colors",
        isAvailable ? "hover:border-primary/40 hover:bg-muted/40" : "cursor-not-allowed opacity-60",
      )}
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt=""
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <UtensilsCrossed className="h-6 w-6 text-muted-foreground" aria-hidden />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate font-medium text-foreground">{item.name}</p>
        {item.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        )}
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium text-foreground">{formatCurrency(item.price)}</span>
          {!isAvailable && <Badge variant="muted">Indisponível</Badge>}
        </div>
      </div>
    </button>
  );
}
