"use client";

import type { DragEvent } from "react";
import { GripVertical, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { AccordionItem } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductCard } from "@/components/cardapio/product-card";
import type { MenuCategory, MenuItem } from "@/types/domain";

interface CategorySectionProps {
  category: MenuCategory;
  items: MenuItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditCategory: () => void;
  onDeleteCategory: () => void;
  onAddProduct: () => void;
  onEditProduct: (item: MenuItem) => void;
  onDuplicateProduct: (item: MenuItem) => void;
  onDeleteProduct: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem) => void;
  duplicatingItemId: string | null;
  // Reordenar categorias (drag-and-drop já existente, só reaproveitado no novo cabeçalho).
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}

/**
 * Uma categoria completa na tela unificada de Cardápio (Sprint
 * "Refatoração da Experiência do Cardápio", 2026-07-28): cabeçalho
 * (accordion) com nome + contagem de produtos + editar/excluir categoria +
 * alça de arrastar (mesma reordenação de sempre, via
 * `PATCH /api/v1/menu/categories/order` — só a apresentação mudou, de lista
 * separada para cabeçalho de cada seção). Corpo com os produtos daquela
 * categoria e o "+ Adicionar Produto" que já abre o formulário com esta
 * categoria pré-selecionada.
 */
export function CategorySection({
  category,
  items,
  open,
  onOpenChange,
  onEditCategory,
  onDeleteCategory,
  onAddProduct,
  onEditProduct,
  onDuplicateProduct,
  onDeleteProduct,
  onToggleAvailability,
  duplicatingItemId,
  onDragStart,
  onDragOver,
  onDragEnd,
}: CategorySectionProps) {
  return (
    <div draggable onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      <AccordionItem
        open={open}
        onOpenChange={onOpenChange}
        title={
          <span className="flex items-center gap-2">
            <span className="font-display text-sm font-semibold text-foreground">{category.name}</span>
            <span className="text-xs text-muted-foreground">
              ({items.length} {items.length === 1 ? "produto" : "produtos"})
            </span>
          </span>
        }
        actions={
          <>
            <span
              className="cursor-grab px-1 text-muted-foreground active:cursor-grabbing"
              aria-label={`Arrastar para reordenar ${category.name}`}
            >
              <GripVertical className="h-4 w-4" aria-hidden />
            </span>
            <Button variant="ghost" size="icon" onClick={onEditCategory} aria-label={`Editar categoria ${category.name}`}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDeleteCategory}
              aria-label={`Excluir categoria ${category.name}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2.5">
          {items.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nenhum produto nesta categoria"
              description="Adicione o primeiro produto para começar a preencher esta categoria."
            />
          ) : (
            items.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                onEdit={onEditProduct}
                onDuplicate={onDuplicateProduct}
                onDelete={onDeleteProduct}
                onToggleAvailability={onToggleAvailability}
                isDuplicating={duplicatingItemId === item.id}
              />
            ))
          )}

          <Button variant="outline" size="sm" onClick={onAddProduct} className="self-start">
            <Plus className="h-4 w-4" />
            Adicionar Produto
          </Button>
        </div>
      </AccordionItem>
    </div>
  );
}
