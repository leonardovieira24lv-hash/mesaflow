"use client";

import Image from "next/image";
import { Archive, ArchiveRestore, Copy, ImageOff, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/types/domain";

interface ProductCardProps {
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onDuplicate: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
  onRestore: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem) => void;
  isDuplicating?: boolean;
  isRestoring?: boolean;
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
 *
 * Sprint "Arquivamento — Visualizar e Restaurar" (2026-07-28, sobre a
 * sprint "Exclusão Lógica de Produtos"): quando `item.isArchived`, o card
 * troca as 3 ações + switch de disponibilidade por um único botão
 * "Restaurar", ganha o badge "Arquivado", um ícone de caixa no lugar do
 * ícone de foto ausente (mesmo com foto real: arquivado é um estado do
 * produto, não da imagem) e opacidade levemente reduzida — sinaliza sem
 * exagerar, o card continua totalmente legível.
 */
export function ProductCard({
  item,
  onEdit,
  onDuplicate,
  onDelete,
  onRestore,
  onToggleAvailability,
  isDuplicating,
  isRestoring,
}: ProductCardProps) {
  const isArchived = item.isArchived;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-surface p-2.5",
        isArchived && "opacity-75",
      )}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt="" fill sizes="56px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff className="h-4 w-4 text-muted-foreground/40" strokeWidth={1.5} aria-hidden />
          </div>
        )}
        {isArchived && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/60">
            <Archive className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
          {isArchived && (
            <Badge variant="muted" className="shrink-0">
              Arquivado
            </Badge>
          )}
        </div>
        <p className="font-numeric text-sm font-bold text-primary">{formatCurrency(item.price)}</p>
      </div>

      {isArchived ? (
        <Button variant="outline" size="sm" onClick={() => onRestore(item)} isLoading={isRestoring} className="shrink-0">
          <ArchiveRestore className="h-4 w-4" />
          Restaurar
        </Button>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
