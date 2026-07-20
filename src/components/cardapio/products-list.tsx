"use client";

import { useState } from "react";
import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { ProductForm, itemFromDto } from "@/components/cardapio/product-form";
import { ROUTES } from "@/constants/routes";
import type { MenuCategory, MenuItem } from "@/types/domain";
import type { ApiError, ApiPaginationMeta } from "@/types/api";

interface ItemDto {
  id: string;
  category_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available: boolean;
}

interface ProductsListProps {
  categories: MenuCategory[];
  initialItems: MenuItem[];
  initialMeta: ApiPaginationMeta;
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const ALL_CATEGORIES = "all";

/**
 * Listagem paginada de Produtos (contrato seção 6.1), com filtro por
 * categoria, criação/edição via modal (`<ProductForm>`), toggle rápido de
 * disponibilidade (mesmo endpoint de edição, payload parcial — seção 6.4) e
 * exclusão com tratamento do caso de produto já usado em pedidos (409).
 */
export function ProductsList({ categories, initialItems, initialMeta }: ProductsListProps) {
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [meta, setMeta] = useState<ApiPaginationMeta>(initialMeta);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES);
  const [isLoading, setIsLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  async function fetchPage(page: number, category: string) {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(meta.per_page) });
      if (category !== ALL_CATEGORIES) params.set("category_id", category);

      const response = await fetch(`/api/v1/menu/items?${params.toString()}`);
      const body = await response.json();

      if (!response.ok) {
        const apiError = body as ApiError;
        toast.error("Não foi possível carregar os produtos", apiError.error?.message);
        setIsLoading(false);
        return;
      }

      setItems((body.data as ItemDto[]).map(itemFromDto));
      setMeta(body.meta as ApiPaginationMeta);
      setIsLoading(false);
    } catch {
      toast.error("Não foi possível conectar", "Verifique sua internet e tente novamente.");
      setIsLoading(false);
    }
  }

  function handleCategoryFilterChange(value: string) {
    setCategoryFilter(value);
    fetchPage(1, value);
  }

  function openCreateModal() {
    setEditingItem(null);
    setModalOpen(true);
  }

  function openEditModal(item: MenuItem) {
    setEditingItem(item);
    setModalOpen(true);
  }

  function handleSaved(saved: MenuItem) {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === saved.id);
      return exists ? prev.map((i) => (i.id === saved.id ? saved : i)) : [...prev, saved];
    });
    toast.success(editingItem ? "Produto atualizado" : "Produto criado");
    setModalOpen(false);
  }

  async function handleToggleAvailability(item: MenuItem) {
    const nextValue = !item.isAvailable;
    // Otimista: atualiza a UI antes da resposta, revertendo se a chamada falhar.
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

  async function handleDelete() {
    if (!deletingItem) return;
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/v1/menu/items/${deletingItem.id}`, { method: "DELETE" });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiError | null;
        toast.error("Não foi possível excluir", body?.error?.message ?? "Tente novamente em instantes.");
        setIsDeleting(false);
        return;
      }

      setItems((prev) => prev.filter((i) => i.id !== deletingItem.id));
      toast.success("Produto excluído");
      setDeletingItem(null);
      setIsDeleting(false);
    } catch {
      toast.error("Não foi possível conectar", "Verifique sua internet e tente novamente.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-64">
          <Select
            value={categoryFilter}
            onChange={(e) => handleCategoryFilterChange(e.target.value)}
            aria-label="Filtrar por categoria"
          >
            <option value={ALL_CATEGORIES}>Todas as categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>

        <Button onClick={openCreateModal} disabled={categories.length === 0}>
          <Plus className="h-4 w-4" />
          Novo produto
        </Button>
      </div>

      {categories.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Cadastre uma{" "}
          <Link href={ROUTES.cardapioCategorias} className="font-medium text-primary underline-offset-4 hover:underline">
            categoria
          </Link>{" "}
          antes de criar produtos.
        </p>
      )}

      {items.length === 0 && !isLoading ? (
        <EmptyState
          icon={Package}
          title="Nenhum produto cadastrado"
          description="Adicione produtos às suas categorias para montar o cardápio."
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Disponível</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full max-w-32" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {categoryNameById.get(item.categoryId) ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono">{currencyFormatter.format(item.price)}</TableCell>
                      <TableCell>
                        <Switch
                          checked={item.isAvailable}
                          onChange={() => handleToggleAvailability(item)}
                          aria-label={`Alternar disponibilidade de ${item.name}`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <ButtonLink
                            href={ROUTES.cardapioProdutoDetalhe(item.id)}
                            variant="ghost"
                            size="sm"
                          >
                            Detalhes
                          </ButtonLink>
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(item)}>
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingItem(item)}
                            className="text-destructive hover:text-destructive"
                          >
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>

          <Pagination
            page={meta.page}
            totalPages={meta.total_pages}
            onPageChange={(page) => fetchPage(page, categoryFilter)}
          />
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? "Editar produto" : "Novo produto"}
      >
        <div className="pb-6">
          <ProductForm
            categories={categories}
            item={editingItem ?? undefined}
            onSaved={handleSaved}
            onCancel={() => setModalOpen(false)}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingItem)}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        title="Excluir produto"
        description={`Tem certeza que deseja excluir "${deletingItem?.name}"? Produtos já usados em pedidos não podem ser excluídos.`}
        variant="destructive"
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        isConfirming={isDeleting}
      />
    </div>
  );
}
