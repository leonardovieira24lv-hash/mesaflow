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
 * Redesign pós-Marco 2: trocado de card vertical em grid 2 colunas para
 * linha horizontal — é o padrão real do mercado brasileiro de cardápio por
 * QR Code (Goomer, Anota AI, iFood), não um capricho estético. Duas razões
 * concretas para a troca, não só "parecer diferente": (1) menu de
 * restaurante é lido em lista vertical contínua, rolando com o polegar —
 * uma grade 2x2 obriga o olho a pular linha/coluna toda hora para comparar
 * preços, uma lista não; (2) a versão em grid tinha exatamente a cara de
 * "grade de cards do shadcn" que foi criticada — uma lista com foto grande
 * à esquerda e hierarquia de texto forte à direita é uma escolha de layout
 * mais difícil de confundir com um template genérico de componentes.
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
        "group flex w-full items-center gap-3.5 rounded-2xl border border-border bg-surface p-2.5 pr-3.5 text-left shadow-card transition-[border-color,box-shadow,transform] duration-150",
        isAvailable
          ? "hover:border-primary/30 hover:shadow-card-hover active:scale-[0.98] active:shadow-card"
          : "cursor-not-allowed opacity-60",
      )}
    >
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-muted to-muted/60">
        {item.image_url ? (
          <>
            {!imageLoaded && <div className="skeleton-shimmer absolute inset-0 animate-shimmer" aria-hidden />}
            <Image
              src={item.image_url}
              alt=""
              fill
              sizes="96px"
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
            <UtensilsCrossed className="h-7 w-7 text-muted-foreground/70" aria-hidden />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
        <p className="line-clamp-1 font-display text-[15px] font-semibold leading-tight text-foreground">
          {item.name}
        </p>
        {item.description && (
          <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{item.description}</p>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="font-mono text-base font-bold tabular-nums text-primary">
            {formatCurrency(item.price)}
          </span>
          {isAvailable ? (
            <span
              aria-hidden
              className="btn-primary-surface flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary-foreground shadow-glow transition-transform group-active:scale-90"
            >
              <Plus className="h-4 w-4" />
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
