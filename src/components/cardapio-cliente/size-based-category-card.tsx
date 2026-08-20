import { ChevronRight, ImageOff } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { PublicMenuCategory } from "@/lib/orders/public-menu";

interface SizeBasedCategoryCardProps {
  category: PublicMenuCategory;
  onSelect: () => void;
}

/**
 * Apresentação pública de uma categoria formada por variações de tamanho.
 *
 * O cliente vê o tipo de produto uma única vez. Os tamanhos/preços ficam
 * para a próxima etapa, evitando transformar cada tamanho em um produto
 * independente na vitrine.
 */
export function SizeBasedCategoryCard({ category, onSelect }: SizeBasedCategoryCardProps) {
  const representative = category.items.find((item) => item.is_available) ?? category.items[0];
  const imageUrl = category.imageUrl ?? representative?.image_url ?? null;
  const availableCount = category.items.filter((item) => item.is_available).length;

  return (
    <button
      type="button"
      disabled={availableCount === 0}
      onClick={onSelect}
      aria-label={availableCount > 0 ? `Escolher tamanho de ${category.name}` : `${category.name} — indisponível no momento`}
      className={cn(
        "group flex w-full items-center gap-4 rounded-2xl border border-border bg-surface p-3.5 text-left elevation-card",
        availableCount > 0
          ? "hover:-translate-y-1 active:translate-y-0 active:scale-[0.99] active:shadow-card"
          : "cursor-not-allowed opacity-60",
      )}
    >
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-muted sm:h-28 sm:w-28">
        {imageUrl ? (
          <Image src={imageUrl} alt="" fill sizes="112px" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} aria-hidden />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1">
        <p className="line-clamp-2 text-lg font-bold leading-tight tracking-tight text-foreground">{category.name}</p>
        <p className="text-sm text-muted-foreground">Escolha o tamanho</p>
        {availableCount === 0 && <span className="text-xs font-semibold text-muted-foreground">Indisponível no momento</span>}
      </div>

      {availableCount > 0 && (
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
          <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
}
