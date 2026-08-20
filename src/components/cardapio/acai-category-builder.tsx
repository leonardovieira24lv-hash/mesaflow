"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { OptionGroupsManager } from "@/components/cardapio/option-groups-manager";
import { toast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";
import type { MenuCategory, MenuItem } from "@/types/domain";
import type { ApiError } from "@/types/api";
import { menuItemFromDto, type MenuItemDto } from "@/types/menu-item-dto";

interface AcaiCategoryBuilderProps {
  category: MenuCategory;
  items: MenuItem[];
  onItemsChange: (items: MenuItem[]) => void;
}

interface SizeDraft {
  name: string;
  price: string;
}

/**
 * Fluxo próprio da açaíteria.
 *
 * A categoria representa um tipo de açaí (ex.: "Açaí tradicional").
 * Os registros de `menu_items` abaixo dela representam os tamanhos/preços.
 * Os complementos continuam sendo `option_groups` vinculados à categoria,
 * então um único grupo serve para todos os tamanhos daquela categoria.
 *
 * Nenhuma tabela nova é necessária e o pedido público continua recebendo
 * `menu_items` + `option_groups` pelo contrato existente.
 */
export function AcaiCategoryBuilder({ category, items, onItemsChange }: AcaiCategoryBuilderProps) {
  const categoryItems = useMemo(() => {
    const next = items.filter((item) => item.categoryId === category.id && !item.isArchived);
    return [...next].sort((a, b) => {
      const aMatch = a.name.match(/([0-9]+(?:[.,][0-9]+)?)\s*(ml|l|litro|g|kg)\b/i);
      const bMatch = b.name.match(/([0-9]+(?:[.,][0-9]+)?)\s*(ml|l|litro|g|kg)\b/i);
      const toBaseUnit = (match: RegExpMatchArray | null) => {

        const valueText = match?.[1];

        const unitText = match?.[2];

        if (!valueText || !unitText) return null;

        const value = Number(valueText.replace(",", "."));

        const unit = unitText.toLowerCase();

        if (unit === "l" || unit === "litro") return value * 1000;

        if (unit === "kg") return value * 1000;

        return value;

      };
      const aSize = toBaseUnit(aMatch);
      const bSize = toBaseUnit(bMatch);
      if (aSize !== null && bSize !== null) return aSize - bSize;
      return a.name.localeCompare(b.name, "pt-BR", { numeric: true, sensitivity: "base" });
    });
  }, [items, category.id]);

  const [draft, setDraft] = useState<SizeDraft>({ name: "", price: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<SizeDraft>({ name: "", price: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ao abrir a categoria existente, o estado local só serve para os campos
  // de edição. Os tamanhos em si vêm sempre do estado do Cardápio pai.
  useEffect(() => {
    setEditingId(null);
    setDraft({ name: "", price: "" });
    setEditingDraft({ name: "", price: "" });
    setError(null);
  }, [category.id]);

  function parsePrice(value: string): number {
    return Number(value.replace(",", "."));
  }

  function replaceItem(nextItem: MenuItem) {
    onItemsChange(items.some((item) => item.id === nextItem.id)
      ? items.map((item) => (item.id === nextItem.id ? nextItem : item))
      : [...items, nextItem]);
  }

  async function addSize() {
    const name = draft.name.trim();
    const price = parsePrice(draft.price);

    if (!name) {
      setError("Informe o tamanho, por exemplo: 300 ml.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError("Informe o preço desse tamanho.");
      return;
    }
    if (categoryItems.some((item) => item.name.trim().toLowerCase() === name.toLowerCase())) {
      setError("Esse tamanho já foi cadastrado nesta categoria.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/menu/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: category.id,
          name,
          price,
          is_available: true,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        const apiError = body as ApiError;
        setError(apiError.error?.message ?? "Não foi possível adicionar esse tamanho.");
        return;
      }

      replaceItem(menuItemFromDto(body.data as MenuItemDto));
      setDraft({ name: "", price: "" });
      toast.success(`${name} adicionado.`);
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit(item: MenuItem) {
    setEditingId(item.id);
    setEditingDraft({ name: item.name, price: item.price.toFixed(2) });
    setError(null);
  }

  async function saveEdit(item: MenuItem) {
    const name = editingDraft.name.trim();
    const price = parsePrice(editingDraft.price);
    if (!name || !Number.isFinite(price) || price <= 0) {
      setError("Informe o tamanho e o preço.");
      return;
    }
    if (categoryItems.some((other) => other.id !== item.id && other.name.trim().toLowerCase() === name.toLowerCase())) {
      setError("Esse tamanho já existe nesta categoria.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/menu/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, price }),
      });
      const body = await response.json();
      if (!response.ok) {
        const apiError = body as ApiError;
        setError(apiError.error?.message ?? "Não foi possível salvar esse tamanho.");
        return;
      }

      replaceItem(menuItemFromDto(body.data as MenuItemDto));
      setEditingId(null);
      toast.success("Tamanho atualizado.");
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteSize(item: MenuItem) {
    setDeletingId(item.id);
    setError(null);
    try {
      const response = await fetch(`/api/v1/menu/items/${item.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiError | null;
        setError(body?.error?.message ?? "Não foi possível excluir esse tamanho.");
        return;
      }

      const body = response.status === 204 ? null : await response.json().catch(() => null);
      if (body?.data?.archived) {
        onItemsChange(items.map((entry) => (entry.id === item.id ? { ...entry, isArchived: true } : entry)));
        toast.success("Tamanho arquivado porque já possui histórico de pedidos.");
      } else {
        onItemsChange(items.filter((entry) => entry.id !== item.id));
        toast.success("Tamanho excluído.");
      }
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 border-t border-ds2-border pt-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ds2-primary">Açaí</p>
        <h3 className="mt-1 text-base font-semibold text-ds2-foreground">Tamanhos e preços</h3>
        <p className="mt-1 text-sm text-ds2-foreground-muted">
          Cadastre aqui os tamanhos que esse tipo de açaí vende. Cada tamanho tem seu próprio preço.
        </p>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="flex flex-col gap-2">
        {categoryItems.length === 0 ? (
          <div className="rounded-ds2-md border border-dashed border-ds2-border bg-ds2-background p-4 text-sm text-ds2-foreground-muted">
            Nenhum tamanho cadastrado ainda. Comece pelo primeiro, por exemplo <strong>300 ml</strong>.
          </div>
        ) : (
          categoryItems.map((item) => (
            <div key={item.id} className="rounded-ds2-md border border-ds2-border bg-ds2-surface p-3">
              {editingId === item.id ? (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-[1fr_110px] gap-2">
                    <Input
                      value={editingDraft.name}
                      onChange={(event) => setEditingDraft((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Ex.: 500 ml"
                      disabled={loading}
                    />
                    <Input
                      value={editingDraft.price}
                      onChange={(event) => setEditingDraft((prev) => ({ ...prev, price: event.target.value }))}
                      inputMode="decimal"
                      placeholder="18,00"
                      disabled={loading}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void saveEdit(item)} isLoading={loading}>Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={loading}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ds2-foreground">{item.name}</p>
                    <p className="text-xs text-ds2-foreground-muted">Tamanho disponível para pedidos</p>
                  </div>
                  <span className="font-numeric text-sm font-semibold text-ds2-primary">{formatCurrency(item.price)}</span>
                  <button type="button" onClick={() => startEdit(item)} className="text-ds2-foreground-muted hover:text-ds2-foreground" aria-label={`Editar ${item.name}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => void deleteSize(item)} disabled={deletingId === item.id} className="text-ds2-danger disabled:opacity-50" aria-label={`Excluir ${item.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="rounded-ds2-md bg-ds2-background p-3 ring-1 ring-ds2-border">
        <p className="mb-2 text-sm font-medium text-ds2-foreground">Adicionar tamanho</p>
        <div className="grid grid-cols-[1fr_110px_auto] gap-2">
          <Input
            value={draft.name}
            onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Ex.: 500 ml"
            disabled={isSaving}
          />
          <Input
            value={draft.price}
            onChange={(event) => setDraft((prev) => ({ ...prev, price: event.target.value }))}
            inputMode="decimal"
            placeholder="18,00"
            disabled={isSaving}
          />
          <Button onClick={() => void addSize()} isLoading={isSaving} aria-label="Adicionar tamanho">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border-t border-ds2-border pt-4">
        <div className="mb-3">
          <p className="text-base font-semibold text-ds2-foreground">Complementos</p>
          <p className="mt-1 text-sm text-ds2-foreground-muted">
            Esses grupos ficam disponíveis para todos os tamanhos deste açaí.
          </p>
        </div>
        <OptionGroupsManager filterCategoryId={category.id} businessType="acai" compact />
      </div>
    </div>
  );
}
