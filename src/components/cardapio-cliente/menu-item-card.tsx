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
 * produtos). Card horizontal: foto quadrada grande à esquerda,
 * nome/descrição/preço à direita, botão "+" ao lado do preço — padrão dos
 * grandes apps de delivery.
 *
 * Sprint de manutenção (2026-08-08): `onError`/fallback na imagem — sem
 * isso, uma imagem que falha ao carregar ficava com `opacity-0` para
 * sempre em vez de cair no placeholder `ImageOff`.
 *
 * Sprint de reconstrução visual (2026-08-08, seguinte): reescrito para
 * usar só paleta padrão do Tailwind — card branco, borda `zinc-200`,
 * sombra discreta que cresce no hover, preço em `emerald-600`, botão "+"
 * em `emerald-500` — sem nenhum token do design system antigo/`ds2-*`.
 * Nenhuma lógica de seleção foi tocada — `onSelect` continua abrindo o
 * mesmo `<ProductDetailModal>`.
 */
export function MenuItemCard({ item, onSelect }: MenuItemCardProps) {
  const isAvailable = item.is_available;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const showImage = Boolean(item.image_url) && !hasError;

  return (
    <button
      type="button"
      disabled={!isAvailable}
      onClick={() => onSelect(item)}
      aria-label={isAvailable ? `Ver detalhes de ${item.name}` : `${item.name} — indisponível no momento`}
      className={cn(
        "group flex w-full items-stretch gap-4 rounded-2xl border border-zinc-200 bg-white p-3.5 text-left shadow-sm transition-all duration-300 ease-out",
        isAvailable
          ? "hover:-translate-y-1 hover:border-zinc-300 hover:shadow-md active:translate-y-0 active:scale-[0.99] active:shadow-sm"
          : "cursor-not-allowed opacity-60",
      )}
    >
      <div className="relative h-36 w-36 shrink-0 overflow-hidden rounded-2xl bg-zinc-100">
        {showImage ? (
          <>
            {!imageLoaded && <div className="absolute inset-0 z-10 animate-pulse bg-zinc-200" aria-hidden />}
            <Image
              src={item.image_url as string}
              alt=""
              fill
              sizes="144px"
              onLoad={() => setImageLoaded(true)}
              onError={() => setHasError(true)}
              className={cn(
                "object-cover transition-transform duration-500 ease-out",
                isAvailable && "group-hover:scale-[1.06]",
                imageLoaded ? "opacity-100" : "opacity-0",
              )}
            />
          </>
        ) : (
          // Placeholder discreto: cinza liso e um ícone pequeno, sem
          // círculo/sombra própria — não deve competir com fotos reais nem
          // parecer um erro.
          <div className="flex h-full w-full items-center justify-center bg-zinc-100">
            <ImageOff className="h-6 w-6 text-zinc-400" strokeWidth={1.5} aria-hidden />
          </div>
        )}

        {!isAvailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
            <Badge variant="muted">Indisponível</Badge>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-1">
        <p className="line-clamp-1 text-lg font-bold leading-tight tracking-tight text-zinc-900">{item.name}</p>
        {item.description && (
          <p className="line-clamp-2 text-[13px] leading-snug text-zinc-500">{item.description}</p>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-lg font-extrabold tabular-nums tracking-tight text-emerald-600">
            {formatCurrency(item.price)}
          </span>

          {isAvailable && (
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/30 transition-transform duration-200 ease-out group-hover:scale-110 group-active:scale-90"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
