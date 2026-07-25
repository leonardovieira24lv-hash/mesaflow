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
 * Sprint de Refinamento Premium do Cardápio (pedido explícito: "cards
 * grandes demais... permitir visualizar 3-4 produtos na tela sem muito
 * scroll"): a foto voltou a encolher (112px → 80px) e os espaçamentos
 * internos foram apertados — a v2 anterior tinha crescido a foto e o botão
 * "+" para dar mais presença ao card; agora a prioridade inverteu para
 * densidade/velocidade de leitura, então parte desse ganho de área volta.
 * Estrutura (foto à esquerda, texto à direita, preço em destaque, "+"
 * pequeno) e os tokens de marca (`--primary`, `.btn-primary-surface`)
 * continuam os mesmos.
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
        "group flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-2 pr-3 text-left shadow-card transition-[border-color,box-shadow,transform] duration-200",
        isAvailable
          ? "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover active:translate-y-0 active:scale-[0.98] active:shadow-card"
          : "cursor-not-allowed opacity-60",
      )}
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg">
        {item.image_url ? (
          <>
            {!imageLoaded && <div className="skeleton-shimmer absolute inset-0 z-10 animate-shimmer" aria-hidden />}
            <Image
              src={item.image_url}
              alt=""
              fill
              sizes="80px"
              onLoad={() => setImageLoaded(true)}
              className={cn(
                "object-cover transition-[opacity,transform] duration-300",
                isAvailable && "group-hover:scale-[1.08]",
                imageLoaded ? "opacity-100" : "opacity-0",
              )}
            />
            <div className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-black/5" aria-hidden />
          </>
        ) : (
          // Placeholder elegante em vez de um retângulo cinza vazio: um
          // círculo com o tom de marca sobre um degradê suave — comunica
          // "prato sem foto ainda", não "algo quebrou".
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/[0.07] via-muted to-muted">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-card">
              <UtensilsCrossed className="h-4 w-4 text-primary/60" aria-hidden />
            </div>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
        <p className="line-clamp-1 font-display text-sm font-semibold leading-tight text-foreground">
          {item.name}
        </p>
        {item.description && (
          <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{item.description}</p>
        )}
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-numeric text-[13px] font-bold tabular-nums text-primary">
            {formatCurrency(item.price)}
          </span>
          {isAvailable ? (
            <span
              aria-hidden
              className="btn-primary-surface flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary-foreground shadow-glow transition-transform duration-200 group-hover:scale-110 group-active:scale-90"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
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
