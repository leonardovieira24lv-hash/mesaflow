"use client";

import type { DragEvent } from "react";
import { Archive, GripVertical, Package, Pencil, Trash2 } from "lucide-react";
import { AccordionItem } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductCard } from "@/components/cardapio/product-card";
import { OptionGroupsManager } from "@/components/cardapio/option-groups-manager";
import type { ProductStatusFilterValue } from "@/components/cardapio/product-status-filter";
import type { MenuCategory, MenuItem } from "@/types/domain";
import type { BusinessType } from "@/lib/business-type";

interface CategorySectionProps {
  category: MenuCategory;
  items: MenuItem[];
  statusFilter: ProductStatusFilterValue;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditCategory: () => void;
  onDeleteCategory: () => void;
  onAddProduct: () => void;
  onEditProduct: (item: MenuItem) => void;
  onDuplicateProduct: (item: MenuItem) => void;
  onDeleteProduct: (item: MenuItem) => void;
  onRestoreProduct: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem) => void;
  duplicatingItemId: string | null;
  restoringItemId: string | null;
  businessType: BusinessType | string | null;
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
 *
 * Sprint "Arquivamento — Visualizar e Restaurar" (2026-07-28): `items` já
 * chega filtrado pelo `statusFilter` ativo (feito no `CardapioManager`,
 * fonte única do estado) — este componente só usa `statusFilter` para
 * adaptar a mensagem do estado vazio e esconder "+ Adicionar Produto"
 * quando o filtro é "Arquivados" (criar produto novo não faz sentido
 * numa visão que é só sobre restaurar).
 *
 * Parada técnica — reorganização do fluxo de Cardápio (2026-08-14):
 * "Opcionais desta categoria" passou a viver AQUI DENTRO, no corpo do
 * acordeão, junto dos produtos — antes ficava numa aba própria no topo
 * (`CardapioManager`), obrigando trocar de tela pra achar o grupo certo
 * no meio de todos os outros. `<OptionGroupsManager filterCategoryId
 * compact>` já resolve toda a exibição/CRUD filtrada sozinho, só
 * passando o id desta categoria — sem lógica nova aqui.
 */
export function CategorySection({
  category,
  items,
  statusFilter,
  open,
  onOpenChange,
  onEditCategory,
  onDeleteCategory,
  onAddProduct,
  onEditProduct,
  onDuplicateProduct,
  onDeleteProduct,
  onRestoreProduct,
  onToggleAvailability,
  duplicatingItemId,
  restoringItemId,
  businessType,
  onDragStart,
  onDragOver,
  onDragEnd,
}: CategorySectionProps) {
  const emptyStateCopy =
    statusFilter === "archived"
      ? { title: "Nenhum produto arquivado", description: "Produtos excluídos com histórico de pedidos aparecem aqui." }
      : { title: "Nenhum produto nesta categoria", description: "Adicione o primeiro produto para começar a preencher esta categoria." };

  return (
    <div draggable onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      <AccordionItem
        open={open}
        onOpenChange={onOpenChange}
        title={
          <span className="flex items-center gap-2">
            <span className="font-display text-sm font-semibold text-ds2-foreground">{category.name}</span>
            <span className="text-xs text-ds2-foreground-muted">
              ({items.length} {items.length === 1 ? "produto" : "produtos"})
            </span>
          </span>
        }
        actions={
          <>
            <span
              className="cursor-grab px-1 text-ds2-foreground-muted active:cursor-grabbing"
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
              <Trash2 className="h-4 w-4 text-ds2-danger" />
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2.5">
          {items.length === 0 ? (
            <EmptyState
              icon={statusFilter === "archived" ? Archive : Package}
              title={emptyStateCopy.title}
              description={emptyStateCopy.description}
            />
          ) : businessType === "acai" ? (
            <div className="flex flex-col gap-2">
              <div className="rounded-ds2-md bg-ds2-primary/[0.04] p-3 ring-1 ring-ds2-primary/10">
                <p className="text-sm font-semibold text-ds2-foreground">Tamanhos cadastrados</p>
                <p className="mt-1 text-xs text-ds2-foreground-muted">
                  Cada item abaixo é um tamanho deste açaí. Para adicionar, alterar ou remover tamanhos e complementos, edite a categoria.
                </p>
              </div>
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-ds2-md border border-ds2-border bg-ds2-surface p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ds2-foreground">{item.name}</p>
                    <p className="text-xs text-ds2-foreground-muted">
                      {item.isAvailable ? "Disponível para pedidos" : "Indisponível"}
                    </p>
                  </div>
                  <span className="font-numeric text-sm font-semibold text-ds2-primary">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.price)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            items.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                onEdit={onEditProduct}
                onDuplicate={onDuplicateProduct}
                onDelete={onDeleteProduct}
                onRestore={onRestoreProduct}
                onToggleAvailability={onToggleAvailability}
                isDuplicating={duplicatingItemId === item.id}
                isRestoring={restoringItemId === item.id}
              />
            ))
          )}

          {statusFilter !== "archived" && businessType !== "acai" && (
            <Button variant="outline" size="sm" onClick={onAddProduct} className="self-start">
              Adicionar Produto
            </Button>
          )}

          {statusFilter !== "archived" && businessType !== "acai" && (
            <div className="mt-1 flex flex-col gap-2 rounded-ds2-lg bg-ds2-danger/[0.04] p-3 ring-1 ring-ds2-danger/10">
              <div className="text-xs font-semibold uppercase tracking-wide text-ds2-danger">
                Opcionais desta categoria
              </div>
              <OptionGroupsManager filterCategoryId={category.id} businessType={businessType} compact />
            </div>
          )}
        </div>
      </AccordionItem>
    </div>
  );
}
