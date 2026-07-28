import { useState } from "react";
import Image from "next/image";
import { ImageOff, Plus } from "lucide-react";
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
 * Sprint "Refinamento Premium do Cardápio" (2026-07-28, sobre a sprint
 * anterior "Redesign Premium"): mesma estrutura (foto no topo, grid de 2
 * colunas, botão "+"), refinado para reduzir o verde a só três pontos
 * (preço, botão "+", categoria ativa — esta última em `category-nav.tsx`)
 * e dar a maior parte do card para a foto (~60% da altura via
 * `aspect-[4/5]`, mais vertical que o `4/3` anterior). Placeholder sem foto
 * trocou o ícone grande num círculo por um ícone pequeno e discreto sobre
 * um fundo cinza liso — "elegante e discreto" em vez de um elemento que
 * competia visualmente com fotos reais. Nome ganhou mais peso, descrição
 * ficou a uma linha só e mais discreta, preço maior. Nenhuma lógica de
 * seleção/carrinho foi tocada.
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
        "group flex w-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-surface text-left shadow-sm transition-[border-color,box-shadow,transform] duration-200",
        isAvailable
          ? "hover:-translate-y-1 hover:border-border hover:shadow-md active:translate-y-0 active:scale-[0.98] active:shadow-sm"
          : "cursor-not-allowed opacity-60",
      )}
    >
      <div className="relative w-full shrink-0">
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-t-2xl bg-muted">
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
                  "object-cover transition-transform duration-300",
                  isAvailable && "group-hover:scale-[1.04]",
                  imageLoaded ? "opacity-100" : "opacity-0",
                )}
              />
            </>
          ) : (
            // Placeholder discreto: cinza liso e um ícone pequeno, sem
            // círculo/sombra própria — não deve competir com fotos reais nem
            // parecer um erro.
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <ImageOff className="h-5 w-5 text-muted-foreground/40" strokeWidth={1.5} aria-hidden />
            </div>
          )}

          {!isAvailable && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface/70 backdrop-blur-[1px]">
              <Badge variant="muted">Indisponível</Badge>
            </div>
          )}
        </div>

        {isAvailable && (
          <span
            aria-hidden
            className="btn-primary-surface absolute -bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full text-primary-foreground shadow-lg ring-4 ring-surface transition-transform duration-200 ease-out group-hover:scale-110 group-active:scale-90"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 px-3.5 pb-3.5 pt-4">
        <p className="line-clamp-1 font-display text-base font-bold leading-tight tracking-tight text-foreground">
          {item.name}
        </p>
        {item.description && (
          <p className="line-clamp-1 text-[11px] leading-snug text-muted-foreground/80">{item.description}</p>
        )}
        <span className="mt-1.5 font-numeric text-[15px] font-bold tabular-nums text-primary">
          {formatCurrency(item.price)}
        </span>
      </div>
    </button>
  );
}
