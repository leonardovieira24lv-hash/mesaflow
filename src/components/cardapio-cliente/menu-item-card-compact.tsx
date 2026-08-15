import { useState } from "react";
import Image from "next/image";
import { ImageOff, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { PublicMenuItem } from "@/lib/orders/public-menu";

interface MenuItemCardCompactProps {
  item: PublicMenuItem;
  onSelect: (item: PublicMenuItem) => void;
  selectedSlot?: 1 | 2 | "both" | null;
}

/**
 * Layout compacto por categoria (2026-08-15) — ideia do dono, comparando
 * com outros cardápios que já viu: produto de base sempre igual (bebida,
 * adicional) fica esquisito ocupando o mesmo card grande de uma pizza.
 * Mockup aprovado antes de codar.
 *
 * Card vertical pequeno, pensado pra grade de 2 colunas (ver
 * `cardapio-cliente-view.tsx`): foto quadrada 48px (opcional — some bem
 * sem foto, mesmo ícone `ImageOff` do card padrão), nome+preço, sem
 * descrição, botão "+" reduzido. Reaproveita o MESMO estado de
 * carregamento de imagem e a MESMA lógica de seleção (meio a meio,
 * indisponível) do `MenuItemCard` padrão — só o tamanho/layout muda, o
 * comportamento é idêntico (as duas categorias podem, em teoria, ter os
 * dois interruptores ligados ao mesmo tempo).
 */
export function MenuItemCardCompact({ item, onSelect, selectedSlot = null }: MenuItemCardCompactProps) {
  const isAvailable = item.is_available;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const showImage = Boolean(item.image_url) && !hasError;
  const isSelected = selectedSlot !== null;

  return (
    <button
      type="button"
      disabled={!isAvailable}
      onClick={() => onSelect(item)}
      aria-label={isAvailable ? `Ver detalhes de ${item.name}` : `${item.name} — indisponível no momento`}
      className={cn(
        "group flex items-center gap-2.5 rounded-xl border border-border bg-surface p-2.5 text-left elevation-card",
        isSelected && "border-emerald-500 ring-1 ring-emerald-500",
        isAvailable
          ? "active:scale-[0.98] active:shadow-card"
          : "cursor-not-allowed opacity-60",
      )}
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
        {showImage ? (
          <>
            {!imageLoaded && <div className="absolute inset-0 z-10 animate-pulse bg-muted" aria-hidden />}
            <Image
              src={item.image_url as string}
              alt=""
              fill
              sizes="48px"
              onLoad={() => setImageLoaded(true)}
              onError={() => setHasError(true)}
              className={cn("object-cover", imageLoaded ? "opacity-100" : "opacity-0")}
            />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <ImageOff className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden />
          </div>
        )}

        {isSelected && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/30">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white shadow-md">
              {selectedSlot === "both" ? "✓" : selectedSlot}
            </span>
          </div>
        )}

        {!isAvailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[1px]" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="line-clamp-1 text-xs font-semibold leading-tight text-foreground">{item.name}</p>
        <span className="text-xs font-bold tabular-nums text-soft-success-foreground">
          {formatCurrency(item.price)}
        </span>
      </div>

      {isAvailable && (
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
}
