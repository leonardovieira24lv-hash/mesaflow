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
 * Sprint "Redesign Completo do Cardápio Público" (2026-07-29): reformulação
 * completa — de card vertical em grid 2 colunas (foto em formato retrato,
 * `aspect-[4/5]`) para card horizontal em lista de coluna única: foto
 * quadrada grande à esquerda, nome/descrição/preço à direita. Três motivos
 * para essa direção em vez de um grid de quadrados: (1) é o padrão real de
 * "cardápio dentro de um restaurante" nos grandes apps de delivery — grid
 * denso de fotos é mais comum na tela de *listar* restaurantes, não na de
 * *itens*; (2) foto quadrada nunca fica em formato retrato, resolvendo isso
 * de vez; (3) coluna única dá espaço horizontal de verdade pra descrição
 * (2 linhas) e pro preço, em vez de espremer tudo num card estreito. O
 * botão "+" saiu de cima da foto (não cabia mais — a foto agora é
 * quadrada, não alta) para o lado do preço, mesmo padrão dos grandes apps.
 *
 * Refinamento seguinte (mesma sprint, mesmo dia): foto aumentada de 112px
 * para 144px — "a foto vende o produto", card mais alto é aceitável e
 * desejado se deixar a apresentação melhor. Sombra trocada de
 * `shadow-sm`/`shadow-md` genéricos do Tailwind para os tokens próprios do
 * tema (`shadow-card`/`shadow-card-hover`, os mesmos usados no resto do
 * Cardápio Público) — mais consistentes com o Design System do que uma
 * sombra padrão não pensada pra fundo escuro. Preço maior (`text-lg`) e
 * botão "+" maior (40px) para ficar mais chamativo, sem introduzir verde
 * em nenhum lugar novo do card (continua restrito a preço + botão, mesma
 * regra de sempre). Nenhuma lógica de seleção foi tocada — `onSelect`
 * continua abrindo o mesmo `<ProductDetailModal>`.
 */
export function MenuItemCard({ item, onSelect }: MenuItemCardProps) {
  const isAvailable = item.is_available;
  const [imageLoaded, setImageLoaded] = useState(false);
  // Sprint de manutenção do Cardápio Público (2026-08-08): sem isso, uma
  // imagem que falha ao carregar (domínio não autorizado, link morto,
  // etc.) ficava com `opacity-0` para sempre — `onLoad` nunca dispara em
  // caso de erro — em vez de cair no placeholder `ImageOff` que já existe
  // logo abaixo para quando `item.image_url` é nulo.
  const [hasError, setHasError] = useState(false);
  const showImage = Boolean(item.image_url) && !hasError;

  return (
    <button
      type="button"
      disabled={!isAvailable}
      onClick={() => onSelect(item)}
      aria-label={isAvailable ? `Ver detalhes de ${item.name}` : `${item.name} — indisponível no momento`}
      className={cn(
        "group flex w-full items-stretch gap-4 rounded-2xl border border-border/70 bg-surface p-3.5 text-left shadow-card transition-[border-color,box-shadow,transform] duration-300 ease-out",
        isAvailable
          ? "hover:-translate-y-1 hover:border-border hover:shadow-card-hover active:translate-y-0 active:scale-[0.99] active:shadow-card"
          : "cursor-not-allowed opacity-60",
      )}
    >
      <div className="relative h-36 w-36 shrink-0 overflow-hidden rounded-2xl bg-muted">
        {showImage ? (
          <>
            {!imageLoaded && <div className="skeleton-shimmer absolute inset-0 z-10 animate-shimmer" aria-hidden />}
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
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <ImageOff className="h-6 w-6 text-muted-foreground/40" strokeWidth={1.5} aria-hidden />
          </div>
        )}

        {!isAvailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/70 backdrop-blur-[1px]">
            <Badge variant="muted">Indisponível</Badge>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-1">
        <p className="line-clamp-1 font-display text-lg font-bold leading-tight tracking-tight text-foreground">
          {item.name}
        </p>
        {item.description && (
          <p className="line-clamp-2 text-[13px] leading-snug text-muted-foreground/80">{item.description}</p>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-numeric text-lg font-extrabold tabular-nums tracking-tight text-primary">
            {formatCurrency(item.price)}
          </span>

          {isAvailable && (
            <span
              aria-hidden
              className="btn-primary-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary-foreground shadow-glow transition-transform duration-200 ease-out group-hover:scale-110 group-active:scale-90"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
