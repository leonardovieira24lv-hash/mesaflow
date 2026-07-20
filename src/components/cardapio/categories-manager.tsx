"use client";

import { useState, type DragEvent, type FormEvent } from "react";
import { GripVertical, Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { createCategorySchema } from "@/lib/validations/menu";
import type { MenuCategory } from "@/types/domain";
import type { ApiError } from "@/types/api";

interface CategoriesManagerProps {
  initialCategories: MenuCategory[];
}

interface CategoryDto {
  id: string;
  name: string;
  position: number;
}

function fromDto(dto: CategoryDto): MenuCategory {
  return { id: dto.id, name: dto.name, position: dto.position };
}

/**
 * Lista + CRUD de Categorias (contrato seção 5). A reordenação usa
 * drag-and-drop nativo (HTML5, sem biblioteca extra): a lista é reordenada
 * localmente ao soltar, e só então persistida via `PATCH .../order` — se a
 * chamada falhar, a lista volta para a ordem anterior.
 */
export function CategoriesManager({ initialCategories }: CategoriesManagerProps) {
  const [categories, setCategories] = useState<MenuCategory[]>(initialCategories);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deletingCategory, setDeletingCategory] = useState<MenuCategory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function openCreateModal() {
    setEditingCategory(null);
    setName("");
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(category: MenuCategory) {
    setEditingCategory(category);
    setName(category.name);
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const result = createCategorySchema.safeParse({ name });
    if (!result.success) {
      setFormError(result.error.issues[0]?.message ?? "Nome inválido.");
      return;
    }

    setIsSubmitting(true);
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
        setFormError(apiError.error?.message ?? "Não foi possível salvar a categoria.");
        setIsSubmitting(false);
        return;
      }

      const saved = fromDto(body.data as CategoryDto);
      setCategories((prev) =>
        isEditing
          ? prev.map((c) => (c.id === saved.id ? saved : c))
          : [...prev, saved].sort((a, b) => a.position - b.position),
      );
      toast.success(isEditing ? "Categoria atualizada" : "Categoria criada");
      setModalOpen(false);
      setIsSubmitting(false);
    } catch {
      setFormError("Não foi possível conectar. Verifique sua internet e tente novamente.");
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deletingCategory) return;
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/v1/menu/categories/${deletingCategory.id}`, { method: "DELETE" });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiError | null;
        toast.error(
          "Não foi possível excluir",
          body?.error?.message ?? "Tente novamente em instantes.",
        );
        setIsDeleting(false);
        return;
      }

      setCategories((prev) => prev.filter((c) => c.id !== deletingCategory.id));
      toast.success("Categoria excluída");
      setDeletingCategory(null);
      setIsDeleting(false);
    } catch {
      toast.error("Não foi possível conectar", "Verifique sua internet e tente novamente.");
      setIsDeleting(false);
    }
  }

  function handleDragStart(index: number) {
    return (event: DragEvent<HTMLDivElement>) => {
      setDragIndex(index);
      event.dataTransfer.effectAllowed = "move";
    };
  }

  function handleDragOver(index: number) {
    return (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (dragIndex === null || dragIndex === index) return;

      setCategories((prev) => {
        // `dragIndex` sempre vem de um índice válido gerado pelo próprio
        // `.map()` da lista (`handleDragStart(index)`), então o item sempre
        // existe — mas `noUncheckedIndexedAccess` (tsconfig) tipa qualquer
        // acesso por índice, inclusive o retorno de `splice`, como possivelmente
        // `undefined`. Guard explícito em vez de non-null assertion, para não
        // silenciar um caso real caso a lista mude de forma inesperada.
        const next = [...prev];
        const [moved] = next.splice(dragIndex, 1);
        if (!moved) return prev;
        next.splice(index, 0, moved);
        return next;
      });
      setDragIndex(index);
    };
  }

  async function handleDragEnd() {
    setDragIndex(null);
    setIsReordering(true);

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
        setIsReordering(false);
        return;
      }

      setCategories((body.data as CategoryDto[]).map(fromDto));
      setIsReordering(false);
    } catch {
      setCategories(previousOrder);
      toast.error("Não foi possível conectar", "A ordem anterior foi restaurada.");
      setIsReordering(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={openCreateModal}>
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
            <Button onClick={openCreateModal} variant="outline">
              <Plus className="h-4 w-4" />
              Nova categoria
            </Button>
          }
        />
      ) : (
        <div
          className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-2"
          aria-busy={isReordering || undefined}
        >
          {categories.map((category, index) => (
            <div
              key={category.id}
              draggable
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver(index)}
              onDragEnd={handleDragEnd}
              className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5 transition-colors hover:bg-muted/40"
            >
              <button
                type="button"
                className="cursor-grab text-muted-foreground active:cursor-grabbing"
                aria-label={`Arrastar para reordenar ${category.name}`}
              >
                <GripVertical className="h-4 w-4" aria-hidden />
              </button>

              <span className="flex-1 text-sm font-medium">{category.name}</span>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEditModal(category)}
                aria-label={`Editar ${category.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeletingCategory(category)}
                aria-label={`Excluir ${category.name}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCategory ? "Editar categoria" : "Nova categoria"}
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 pb-6">
          <FormField label="Nome da categoria" error={formError ?? undefined} required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Lanches"
              disabled={isSubmitting}
              autoFocus
            />
          </FormField>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
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
        onConfirm={handleDelete}
        isConfirming={isDeleting}
      />
    </div>
  );
}
