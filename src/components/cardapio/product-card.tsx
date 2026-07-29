"use client";

import Image from "next/image";
import { Copy, ImageOff, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/format";
import type { MenuItem } from "@/types/domain";

interface ProductCardProps {
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onDuplicate: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem) => void;
  isDuplicating?: boolean;
}

/**
 * Card compacto de produto (Sprint "Refatoração da Experiência do
 * Cardápio", 2026-07-28) — substitui a linha de tabela do antigo
 * `ProductsList`. Imagem quadrada pequena, nome, preço, disponibilidade e
 * as 3 ações do briefing (Editar/Duplicar/Excluir) sempre visíveis, sem
 * menu escondido — o objetivo da sprint é reduzir cliques, não escondê-los
 * atrás de mais um menu.
 *
 * "Duplicar" reaproveita o `POST /api/v1/menu/items` que já existe (mesmo
 * endpoint de criar um produto do zero) — a cópia dos campos acontece no
 * componente pai (`CategorySection`), este card só dispara a ação.
 */
export function ProductCard({ item, onEdit, onDuplicate, onDelete, onToggleAvailability, isDuplicating }: ProductCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2.5">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt="" fill sizes="56px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff className="h-4 w-4 text-muted-foreground/40" strokeWidth={1.5} aria-hidden />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
        <p className="font-numeric text-sm font-bold text-primary">{formatCurrency(item.price)}</p>
      </div>

      <Switch
        checked={item.isAvailable}
        onChange={() => onToggleAvailability(item)}
        aria-label={`Alternar disponibilidade de ${item.name}`}
      />

      <div className="flex shrink-0 items-center gap-0.5">
        <Button variant="ghost" size="icon" onClick={() => onEdit(item)} aria-label={`Editar ${item.name}`}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDuplicate(item)}
          disabled={isDuplicating}
          aria-label={`Duplicar ${item.name}`}
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(item)}
          aria-label={`Excluir ${item.name}`}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
