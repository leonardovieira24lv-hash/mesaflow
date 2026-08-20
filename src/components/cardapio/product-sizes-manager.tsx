"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";
import type { ApiError, ApiSuccess } from "@/types/api";
import type { MenuItem } from "@/types/domain";

interface SizeItem {
  id: string;
  name: string;
  price: number;
}

interface OptionGroupDto {
  id: string;
  name: string;
  categoryId: string | null;
  menuItemId: string | null;
  selectionType: "single" | "multiple";
  maxSelections: number | null;
  required: boolean;
  groupType: "standard" | "size";
  items: { id: string; name: string; priceDelta: number }[];
}

interface ProductSizesManagerProps {
  item: MenuItem;
  /** Preço base atual do produto. No modo de tamanhos, é sempre o preço do menor tamanho. */
  basePrice: number;
  onBasePriceChange: (price: number) => void;
  onHasSizesChange?: (hasSizes: boolean) => void;
}

/**
 * Editor específico de tamanhos para açaí.
 *
 * Reaproveita `option_groups`/`option_group_items` por baixo dos panos para
 * preservar o contrato de pedidos e o snapshot de opções. A diferença é
 * apenas de experiência: aqui o dono informa PREÇOS FINAIS, não deltas.
 */
export function ProductSizesManager({ item, basePrice, onBasePriceChange, onHasSizesChange }: ProductSizesManagerProps) {
  const [group, setGroup] = useState<OptionGroupDto | null>(null);
  const [sizes, setSizes] = useState<SizeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingPrice, setEditingPrice] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/v1/menu/option-groups");
        const body: ApiSuccess<OptionGroupDto[]> | ApiError = await response.json();
        if (!response.ok || "error" in body) {
          throw new Error(("error" in body && body.error?.message) || "Não foi possível carregar os tamanhos.");
        }
        const found = body.data.find((candidate) => candidate.groupType === "size" && candidate.menuItemId === item.id) ?? null;
        if (!cancelled) {
          setGroup(found);
          const mapped = found
            ? found.items.map((option) => ({ id: option.id, name: option.name, price: basePrice + option.priceDelta }))
            : [];
          setSizes(mapped);
          onHasSizesChange?.(mapped.length > 0);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Não foi possível carregar os tamanhos.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  function parsePrice(value: string): number {
    return Number(value.replace(",", "."));
  }

  async function ensureGroup(): Promise<OptionGroupDto | null> {
    if (group) return group;
    setIsCreatingGroup(true);
    try {
      const response = await fetch("/api/v1/menu/option-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Tamanhos",
          menuItemId: item.id,
          selectionType: "single",
          required: true,
          groupType: "size",
        }),
      });
      const body: ApiSuccess<OptionGroupDto> | ApiError = await response.json();
      if (!response.ok || "error" in body) {
        setError(("error" in body && body.error?.message) || "Não foi possível criar a área de tamanhos.");
        return null;
      }
      setGroup(body.data);
      return body.data;
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
      return null;
    } finally {
      setIsCreatingGroup(false);
    }
  }

  async function addSize() {
    const price = parsePrice(newPrice);
    if (!newName.trim()) {
      setError("Informe o tamanho.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError("Informe um preço válido.");
      return;
    }
    if (sizes.length === 0 && Math.abs(price - basePrice) > 0.009) {
      setError(`O primeiro tamanho precisa ter o preço base do produto: ${formatCurrency(basePrice)}.`);
      return;
    }
    if (sizes.some((size) => price < size.price - 0.009)) {
      setError("Os tamanhos devem usar preços iguais ou maiores que o menor tamanho.");
      return;
    }

    setIsAdding(true);
    setError(null);
    try {
      const targetGroup = await ensureGroup();
      if (!targetGroup) return;
      const priceDelta = Number((price - basePrice).toFixed(2));
      const response = await fetch(`/api/v1/menu/option-groups/${targetGroup.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), priceDelta }),
      });
      const body: ApiSuccess<{ id: string; name: string; priceDelta: number }> | ApiError = await response.json();
      if (!response.ok || "error" in body) {
        setError(("error" in body && body.error?.message) || "Não foi possível adicionar o tamanho.");
        return;
      }
      const created = { id: body.data.id, name: body.data.name, price: basePrice + body.data.priceDelta };
      setSizes((prev) => [...prev, created]);
      onHasSizesChange?.(true);
      setNewName("");
      setNewPrice("");
      toast.success("Tamanho adicionado.");
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setIsAdding(false);
    }
  }

  function startEdit(size: SizeItem) {
    setEditingId(size.id);
    setEditingName(size.name);
    setEditingPrice(size.price.toFixed(2));
    setError(null);
  }

  async function syncProductBasePrice(price: number): Promise<boolean> {
    if (Math.abs(price - basePrice) <= 0.009) return true;
    try {
      const response = await fetch(`/api/v1/menu/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price }),
      });
      if (!response.ok) {
        const body: ApiError = await response.json().catch(() => ({ error: { message: "Não foi possível atualizar o preço base." } }));
        setError(body.error?.message ?? "Não foi possível atualizar o preço base.");
        return false;
      }
      onBasePriceChange(price);
      return true;
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
      return false;
    }
  }

  async function saveEdit(size: SizeItem) {
    const price = parsePrice(editingPrice);
    if (!editingName.trim() || !Number.isFinite(price) || price <= 0) {
      setError("Informe nome e preço válidos.");
      return;
    }
    if (sizes.some((other) => other.id !== size.id && price < other.price - 0.009)) {
      setError("Os tamanhos devem usar preços iguais ou maiores que o menor tamanho.");
      return;
    }

    setError(null);
    try {
      const isFirst = size.id === sizes[0]?.id;
      const response = await fetch(`/api/v1/menu/option-groups/${group?.id}/items/${size.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingName.trim(),
          priceDelta: isFirst ? 0 : Number((price - basePrice).toFixed(2)),
        }),
      });
      const body: ApiSuccess<{ id: string; name: string; priceDelta: number }> | ApiError = await response.json();
      if (!response.ok || "error" in body) {
        setError(("error" in body && body.error?.message) || "Não foi possível salvar o tamanho.");
        return;
      }
      if (isFirst && !(await syncProductBasePrice(price))) return;
      const nextBasePrice = isFirst ? price : basePrice;
      setSizes((prev) => prev.map((entry) => (entry.id === size.id ? { ...entry, name: body.data.name, price: nextBasePrice + body.data.priceDelta } : entry)));
      setEditingId(null);
      toast.success("Tamanho atualizado.");
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    }
  }

  async function deleteSize(size: SizeItem) {
    if (!group) return;
    setDeletingId(size.id);
    setError(null);
    try {
      const response = await fetch(`/api/v1/menu/option-groups/${group.id}/items/${size.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body: ApiError = await response.json();
        setError(body.error?.message ?? "Não foi possível excluir o tamanho.");
        return;
      }
      const next = sizes.filter((entry) => entry.id !== size.id);
      if (size.id === sizes[0]?.id && next.length > 0) {
        const nextBaseSize = next[0];
        if (!nextBaseSize) return;
        const previousBasePrice = basePrice;
        if (!(await syncProductBasePrice(nextBaseSize.price))) return;
        const promoteResponse = await fetch(`/api/v1/menu/option-groups/${group.id}/items/${nextBaseSize.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priceDelta: 0 }),
        });
        if (!promoteResponse.ok) {
          await fetch(`/api/v1/menu/items/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ price: previousBasePrice }),
          });
          onBasePriceChange(previousBasePrice);
          setError("O tamanho seguinte não pôde assumir o preço base. Tente novamente.");
          return;
        }
      }
      setSizes(next);
      onHasSizesChange?.(next.length > 0);
      if (next.length === 0) {
        const deleteGroupResponse = await fetch(`/api/v1/menu/option-groups/${group.id}`, { method: "DELETE" });
        if (deleteGroupResponse.ok) setGroup(null);
      }
      toast.success("Tamanho excluído.");
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-ds2-lg bg-ds2-primary/[0.04] p-3 ring-1 ring-ds2-primary/10">
      <div>
        <h3 className="text-sm font-semibold text-ds2-foreground">Tamanhos e preços</h3>
        <p className="mt-0.5 text-xs text-ds2-foreground-muted">
          Cadastre aqui o tamanho e o preço final. O menor tamanho usa o preço base do produto.
        </p>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      {isLoading ? (
        <div className="flex justify-center py-4"><Spinner className="h-5 w-5" /></div>
      ) : (
        <>
          {sizes.map((size, index) => (
            <div key={size.id} className="rounded-ds2-sm border border-ds2-border bg-ds2-surface p-3">
              {editingId === size.id ? (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-[1fr_110px] gap-2">
                    <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} placeholder="Ex.: 500 ml" />
                    <Input value={editingPrice} onChange={(e) => setEditingPrice(e.target.value)} inputMode="decimal" placeholder="0,00" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void saveEdit(size)}>Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => startEdit(size)} className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-medium text-ds2-foreground">{size.name}</span>
                    {index === 0 && <span className="text-[11px] text-ds2-foreground-muted">Preço base</span>}
                  </button>
                  <span className="font-numeric text-sm font-semibold text-ds2-primary">{formatCurrency(size.price)}</span>
                  <button
                    type="button"
                    onClick={() => void deleteSize(size)}
                    disabled={deletingId === size.id}
                    aria-label={`Excluir tamanho ${size.name}`}
                    className="text-ds2-danger disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}

          <div className="grid grid-cols-[1fr_110px_auto] gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex.: 500 ml" disabled={isAdding || isCreatingGroup} />
            <Input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} inputMode="decimal" placeholder="Preço" disabled={isAdding || isCreatingGroup} />
            <Button onClick={() => void addSize()} isLoading={isAdding || isCreatingGroup} aria-label="Adicionar tamanho">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] text-ds2-foreground-muted">
            Ex.: 300 ml R$15 · 500 ml R$18 · 1 litro R$27. Os preços são mostrados ao cliente como preço final.
          </p>
        </>
      )}
    </div>
  );
}
