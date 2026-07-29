"use client";

import { useState, type DragEvent, type FormEvent } from "react";
import { Plus, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { CategorySection } from "@/components/cardapio/category-section";
import { ProductStatusFilter, type ProductStatusFilterValue } from "@/components/cardapio/product-status-filter";
import { ProductForm } from "@/components/cardapio/product-form";
import { menuItemFromDto, type MenuItemDto } from "@/types/menu-item-dto";
import { createCategorySchema } from "@/lib/validations/menu";
import type { MenuCategory, MenuItem } from "@/types/domain";
import type { ApiError } from "@/types/api";

interface CategoryDto {
  id: string;
  name: string;
  position: number;
}

function categoryFromDto(dto: CategoryDto): MenuCategory {
  return { id: dto.id, name: dto.name, position: dto.position };
}

interface CardapioManagerProps {
  restaurantId: string;
  initialCategories: MenuCategory[];
  initialItems: MenuItem[];
}

/**
 * Tela única de "Cardápio" (Sprint "Refatoração da Experiência do
 * Cardápio", 2026-07-28) — substitui as antigas telas separadas de
 * Categorias (`CategoriesManager`) e Produtos (`ProductsList`). Todo o
 * fluxo de montar o cardápio acontece aqui, sem navegação entre páginas:
 * criar categoria → categoria aparece na hora, expandida, com
 * "+ Adicionar Produto" pronto → formulário abre com aquela categoria já
 * selecionada.
 *
 * Nenhuma chamada de API mudou em relação às telas antigas — só a
 * organização da interface. A única diferença de dados é que a página que
 * carrega este componente busca *todos* os produtos do restaurante de uma
 * vez (sem o corte de paginação que a tela antiga de Produtos usava),
 * porque agrupar por categoria exige a lista inteira. Depois de qualquer
 * criação/edição/exclusão, o estado local é atualizado diretamente a
 * partir da resposta da API (mesmo padrão que `CategoriesManager` já
 * usava) — sem essa lista precisar ser paginada, não há motivo para
 * buscar do zero a cada mudança.
 */
export function CardapioManager({ restaurantId, initialCategories, initialItems }: CardapioManagerProps) {
  const [categories, setCategories] = useState<MenuCategory[]>(initialCategories);
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [openCategoryIds, setOpenCategoryIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilterValue>("active");

  // Reordenação de categorias (drag-and-drop) — mesma lógica de sempre.
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Modal de categoria (criar/editar)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryFormError, setCategoryFormError] = useState<string | null>(null);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<MenuCategory | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  // Modal de produto (criar/editar)
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [productModalCategoryId, setProductModalCategoryId] = useState<string | undefined>(undefined);
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [duplicatingItemId, setDuplicatingItemId] = useState<string | null>(null);
  const [restoringItemId, setRestoringItemId] = useState<string | null>(null);

  function itemsForCategory(categoryId: string) {
    return items
      .filter((item) => item.categoryId === categoryId)
      .filter((item) => {
        if (statusFilter === "active") return !item.isArchived;
        if (statusFilter === "archived") return item.isArchived;
        return true;
      });
  }

  function setCategoryOpen(categoryId: string, open: boolean) {
    setOpenCategoryIds((prev) => {
      const next = new Set(prev);
      if (open) next.add(categoryId);
      else next.delete(categoryId);
      return next;
    });
  }

  // ── Categorias ──────────────────────────────────────────────────────────

  function openCreateCategoryModal() {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryFormError(null);
    setCategoryModalOpen(true);
  }

  function openEditCategoryModal(category: MenuCategory) {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryFormError(null);
    setCategoryModalOpen(true);
  }

  async function handleCategorySubmit(event: FormEvent) {
    event.preventDefault();
    setCategoryFormError(null);

    const result = createCategorySchema.safeParse({ name: categoryName });
    if (!result.success) {
      setCategoryFormError(result.error.issues[0]?.message ?? "Nome inválido.");
      return;
    }

    setIsSavingCategory(true);
    try {
      const isEditing = Boolean(editingCategory);
      const response = await fetch(
        isEditing ? `/api/v1/menu/categories/${editingCategory!.id}` : "/api/v1/menu/categories",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: result.data.name }),
        },
      );
      const body = await response.json();

      if (!response.ok) {
        const apiError = body as ApiError;
        setCategoryFormError(apiError.error?.message ?? "Não foi possível salvar a categoria.");
        setIsSavingCategory(false);
        return;
      }

      const saved = categoryFromDto(body.data as CategoryDto);
      setCategories((prev) =>
        isEditing
          ? prev.map((c) => (c.id === saved.id ? saved : c))
          : [...prev, saved].sort((a, b) => a.position - b.position),
      );

      // Categoria nova: fica visível e já expandida, com "+ Adicionar
      // Produto" pronto — sem navegar pra lugar nenhum.
      if (!isEditing) setCategoryOpen(saved.id, true);

      toast.success(isEditing ? "Categoria atualizada" : "Categoria criada");
      setCategoryModalOpen(false);
      setIsSavingCategory(false);
    } catch {
      setCategoryFormError("Não foi possível conectar. Verifique sua internet e tente novamente.");
      setIsSavingCategory(false);
    }
  }

  async function handleDeleteCategory() {
    if (!deletingCategory) return;
    setIsDeletingCategory(true);

    try {
      const response = await fetch(`/api/v1/menu/categories/${deletingCategory.id}`, { method: "DELETE" });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiError | null;
        toast.error("Não foi possível excluir", body?.error?.message ?? "Tente novamente em instantes.");
        setIsDeletingCategory(false);
        return;
      }

      setCategories((prev) => prev.filter((c) => c.id !== deletingCategory.id));
      toast.success("Categoria excluída");
      setDeletingCategory(null);
      setIsDeletingCategory(false);
    } catch {
      toast.error("Não foi possível conectar", "Verifique sua internet e tente novamente.");
      setIsDeletingCategory(false);
    }
  }

  function handleCategoryDragStart(index: number) {
    return (event: DragEvent<HTMLDivElement>) => {
      setDragIndex(index);
      event.dataTransfer.effectAllowed = "move";
    };
  }

  function handleCategoryDragOver(index: number) {
    return (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (dragIndex === null || dragIndex === index) return;

      setCategories((prev) => {
        const next = [...prev];
        const [moved] = next.splice(dragIndex, 1);
        if (!moved) return prev;
        next.splice(index, 0, moved);
        return next;
      });
      setDragIndex(index);
    };
  }

  async function handleCategoryDragEnd() {
    setDragIndex(null);
    const orderedIds = categories.map((c) => c.id);
    const previousOrder = categories;

    try {
      const response = await fetch("/api/v1/menu/categories/order", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordered_ids: orderedIds }),
      });
      const body = await response.json();

      if (!response.ok) {
        setCategories(previousOrder);
        const apiError = body as ApiError;
        toast.error("Não foi possível salvar a nova ordem", apiError.error?.message);
        return;
      }

      setCategories((body.data as CategoryDto[]).map(categoryFromDto));
    } catch {
      setCategories(previousOrder);
      toast.error("Não foi possível conectar", "A ordem anterior foi restaurada.");
    }
  }

  // ── Produtos ────────────────────────────────────────────────────────────

  function openCreateProductModal(categoryId: string) {
    setEditingItem(null);
    setProductModalCategoryId(categoryId);
    setProductModalOpen(true);
  }

  function openEditProductModal(item: MenuItem) {
    setEditingItem(item);
    setProductModalCategoryId(undefined);
    setProductModalOpen(true);
  }

  function handleProductSaved(saved: MenuItem) {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === saved.id);
      return exists ? prev.map((i) => (i.id === saved.id ? saved : i)) : [...prev, saved];
    });
    setCategoryOpen(saved.categoryId, true);
    toast.success(editingItem ? "Produto atualizado" : "Produto criado");
    setProductModalOpen(false);
  }

  async function handleToggleAvailability(item: MenuItem) {
    const nextValue = !item.isAvailable;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isAvailable: nextValue } : i)));

    try {
      const response = await fetch(`/api/v1/menu/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_available: nextValue }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiError | null;
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isAvailable: item.isAvailable } : i)));
        toast.error("Não foi possível atualizar", body?.error?.message);
      }
    } catch {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isAvailable: item.isAvailable } : i)));
      toast.error("Não foi possível conectar", "Verifique sua internet e tente novamente.");
    }
  }

  /**
   * "Duplicar" reaproveita o `POST /api/v1/menu/items` de criação — mesmo
   * endpoint, mesmo contrato, só copiando os campos do produto de origem
   * (com "(cópia)" no nome pra diferenciar). Nenhuma rota nova.
   */
  async function handleDuplicateProduct(item: MenuItem) {
    setDuplicatingItemId(item.id);
    try {
      const response = await fetch("/api/v1/menu/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: item.categoryId,
          name: `${item.name} (cópia)`,
          description: item.description || undefined,
          price: item.price,
          image_url: item.imageUrl || undefined,
          is_available: item.isAvailable,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        const apiError = body as ApiError;
        toast.error("Não foi possível duplicar", apiError.error?.message);
        return;
      }

      setItems((prev) => [...prev, menuItemFromDto(body.data as MenuItemDto)]);
      toast.success("Produto duplicado");
    } catch {
      toast.error("Não foi possível conectar", "Verifique sua internet e tente novamente.");
    } finally {
      setDuplicatingItemId(null);
    }
  }

  /**
   * Sprint "Arquivamento — Visualizar e Restaurar" (2026-07-28): o DELETE
   * agora responde de dois jeitos possíveis (`src/app/api/v1/menu/items/[id]/route.ts`):
   * `204` sem corpo (excluído de verdade) ou `200` com `{ archived: true }`
   * (tinha histórico de pedidos, foi arquivado em vez de apagado). O
   * feedback e a atualização de estado precisam ser diferentes nos dois
   * casos — o segundo é sucesso, não erro, mesmo que o produto continue
   * existindo.
   */
  async function handleDeleteProduct() {
    if (!deletingItem) return;
    setIsDeletingItem(true);

    try {
      const response = await fetch(`/api/v1/menu/items/${deletingItem.id}`, { method: "DELETE" });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiError | null;
        toast.error("Não foi possível excluir", body?.error?.message ?? "Tente novamente em instantes.");
        setIsDeletingItem(false);
        return;
      }

      const body = response.status === 204 ? null : await response.json().catch(() => null);
      const wasArchived = Boolean(body?.data?.archived);

      if (wasArchived) {
        setItems((prev) => prev.map((i) => (i.id === deletingItem.id ? { ...i, isArchived: true } : i)));
        toast.success(
          "Produto arquivado",
          "Este produto possui histórico de pedidos. Para preservar o histórico de vendas, ele foi arquivado automaticamente e removido do cardápio. Você poderá restaurá-lo futuramente.",
        );
      } else {
        setItems((prev) => prev.filter((i) => i.id !== deletingItem.id));
        toast.success("Produto excluído");
      }

      setDeletingItem(null);
      setIsDeletingItem(false);
    } catch {
      toast.error("Não foi possível conectar", "Verifique sua internet e tente novamente.");
      setIsDeletingItem(false);
    }
  }

  /** "Restaurar" reaproveita o mesmo `PATCH` de edição parcial já usado pelo toggle de disponibilidade — só envia `is_archived: false`. */
  async function handleRestoreProduct(item: MenuItem) {
    setRestoringItemId(item.id);
    try {
      const response = await fetch(`/api/v1/menu/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_archived: false }),
      });
      const body = await response.json();

      if (!response.ok) {
        const apiError = body as ApiError;
        toast.error("Não foi possível restaurar", apiError.error?.message);
        return;
      }

      setItems((prev) => prev.map((i) => (i.id === item.id ? menuItemFromDto(body.data as MenuItemDto) : i)));
      toast.success("Produto restaurado");
    } catch {
      toast.error("Não foi possível conectar", "Verifique sua internet e tente novamente.");
    } finally {
      setRestoringItemId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProductStatusFilter value={statusFilter} onChange={setStatusFilter} />
        <Button onClick={openCreateCategoryModal}>
          <Plus className="h-4 w-4" />
          Nova categoria
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="Nenhuma categoria cadastrada"
          description="Crie a primeira categoria para começar a montar o cardápio (ex.: Lanches, Bebidas)."
          action={
            <Button onClick={openCreateCategoryModal} variant="outline">
              <Plus className="h-4 w-4" />
              Nova categoria
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {categories.map((category, index) => (
            <CategorySection
              key={category.id}
              category={category}
              items={itemsForCategory(category.id)}
              statusFilter={statusFilter}
              open={openCategoryIds.has(category.id)}
              onOpenChange={(open) => setCategoryOpen(category.id, open)}
              onEditCategory={() => openEditCategoryModal(category)}
              onDeleteCategory={() => setDeletingCategory(category)}
              onAddProduct={() => openCreateProductModal(category.id)}
              onEditProduct={openEditProductModal}
              onDuplicateProduct={handleDuplicateProduct}
              onDeleteProduct={setDeletingItem}
              onRestoreProduct={handleRestoreProduct}
              onToggleAvailability={handleToggleAvailability}
              duplicatingItemId={duplicatingItemId}
              restoringItemId={restoringItemId}
              onDragStart={handleCategoryDragStart(index)}
              onDragOver={handleCategoryDragOver(index)}
              onDragEnd={handleCategoryDragEnd}
            />
          ))}
        </div>
      )}

      {/* Modal de categoria */}
      <Modal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title={editingCategory ? "Editar categoria" : "Nova categoria"}
      >
        <form onSubmit={handleCategorySubmit} noValidate className="flex flex-col gap-4 pb-6">
          <FormField label="Nome da categoria" error={categoryFormError ?? undefined} required>
            <Input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Ex.: Lanches"
              disabled={isSavingCategory}
              autoFocus
            />
          </FormField>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setCategoryModalOpen(false)} disabled={isSavingCategory}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSavingCategory}>
              {editingCategory ? "Salvar" : "Criar categoria"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingCategory)}
        onOpenChange={(open) => !open && setDeletingCategory(null)}
        title="Excluir categoria"
        description={`Tem certeza que deseja excluir "${deletingCategory?.name}"? Categorias com produtos vinculados não podem ser excluídas.`}
        variant="destructive"
        confirmLabel="Excluir"
        onConfirm={handleDeleteCategory}
        isConfirming={isDeletingCategory}
      />

      {/* Modal de produto */}
      <Modal
        open={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        title={editingItem ? "Editar produto" : "Novo produto"}
      >
        <div className="pb-6">
          <ProductForm
            categories={categories}
            restaurantId={restaurantId}
            item={editingItem ?? undefined}
            defaultCategoryId={productModalCategoryId}
            onSaved={handleProductSaved}
            onCancel={() => setProductModalOpen(false)}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingItem)}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        title="Excluir produto"
        description={`Tem certeza que deseja excluir "${deletingItem?.name}"? Se ele já tiver pedidos no histórico, será arquivado em vez de apagado (dá para restaurar depois).`}
        variant="destructive"
        confirmLabel="Excluir"
        onConfirm={handleDeleteProduct}
        isConfirming={isDeletingItem}
      />
    </div>
  );
}
