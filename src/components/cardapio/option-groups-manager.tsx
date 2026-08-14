"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, Pencil, ListPlus, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";
import type { MenuCategory, MenuItem } from "@/types/domain";
import type { ApiError, ApiSuccess } from "@/types/api";

interface OptionGroupItemDto {
  id: string;
  name: string;
  priceDelta: number;
}

interface OptionGroupDto {
  id: string;
  name: string;
  categoryId: string | null;
  menuItemId: string | null;
  // Sistema de Opcionais, Fase 2 (2026-08-14).
  selectionType: "single" | "multiple";
  maxSelections: number | null;
  required: boolean;
  items: OptionGroupItemDto[];
}

interface OptionGroupsManagerProps {
  categories?: MenuCategory[];
  items?: MenuItem[];
  /**
   * Parada técnica — reorganização do fluxo de Cardápio (2026-08-14):
   * antes, "Grupos de opção" era uma aba separada no topo, mostrando TODOS
   * os grupos do restaurante numa lista só (achava-se o grupo certo "na
   * unha", rolando e comparando categoria/produto). Agora este componente
   * é renderizado DENTRO do acordeão de cada categoria (`category-section.tsx`)
   * — `filterCategoryId` filtra a exibição só pros grupos daquela
   * categoria, e novo grupo já nasce vinculado a ela (alvo fixo, sem
   * mostrar o seletor "Vale para").
   */
  filterCategoryId?: string;
  /**
   * Mesma ideia, pro caso de opcional vinculado a 1 produto específico
   * (ex.: "Ponto da carne" só no X-Tudo) — renderizado dentro do
   * formulário de edição do produto, não mais escondido na aba antiga.
   */
  filterMenuItemId?: string;
  /** Esconde o parágrafo de instrução e deixa o cabeçalho mais discreto — usado nos dois casos acima, onde o contexto (categoria/produto) já está óbvio ao redor. */
  compact?: boolean;
}

/**
 * Sistema de Opcionais, Fase 1 (escolha única obrigatória) — configuração
 * pelo próprio dono: criar grupos (ex.: "Borda", "Ponto da carne"),
 * vinculados a uma categoria inteira ou a 1 produto específico, e cadastrar
 * as opções dentro de cada grupo (nome + valor adicional).
 *
 * Autocontido — busca os próprios dados (`GET /api/v1/menu/option-groups`),
 * só recebe `categories`/`items` como props (já carregados pelo
 * `CardapioManager` pai) para montar o seletor de alvo do grupo, sem
 * duplicar essa busca.
 */
export function OptionGroupsManager({
  categories = [],
  items = [],
  filterCategoryId,
  filterMenuItemId,
  compact,
}: OptionGroupsManagerProps) {
  const [groups, setGroups] = useState<OptionGroupDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  // Sistema de Opcionais, Fase 2 (2026-08-14) — `null` = criando um grupo
  // novo; um `OptionGroupDto` = editando esse grupo (modal reaproveitado
  // pros dois casos, mesmo formulário).
  const [editingGroup, setEditingGroup] = useState<OptionGroupDto | null>(null);
  const [groupName, setGroupName] = useState("");
  const [targetType, setTargetType] = useState<"category" | "item">("category");
  const [targetId, setTargetId] = useState("");
  const [selectionType, setSelectionType] = useState<"single" | "multiple">("single");
  const [maxSelections, setMaxSelections] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [groupFormError, setGroupFormError] = useState<string | null>(null);

  const [deletingGroup, setDeletingGroup] = useState<OptionGroupDto | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  const [addingItemToGroupId, setAddingItemToGroupId] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [itemFormError, setItemFormError] = useState<string | null>(null);

  const [deletingItem, setDeletingItem] = useState<{ groupId: string; itemId: string; itemName: string } | null>(
    null,
  );
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, []);

  async function fetchGroups() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/menu/option-groups");
      const body: ApiSuccess<OptionGroupDto[]> | ApiError = await response.json();
      if (!response.ok || "error" in body) {
        setError(("error" in body && body.error?.message) || "Não foi possível carregar os grupos de opção.");
        return;
      }
      setGroups(body.data);
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  function openCreateGroupModal() {
    setEditingGroup(null);
    setGroupName("");
    // Parada técnica (2026-08-14) — quando renderizado dentro de uma
    // categoria/produto (`filterCategoryId`/`filterMenuItemId`), o alvo já
    // nasce fixo nesse contexto: não faz sentido perguntar "vale para
    // qual categoria" se o grupo já está sendo criado de dentro dela.
    if (filterCategoryId !== undefined) {
      setTargetType("category");
      setTargetId(filterCategoryId);
    } else if (filterMenuItemId !== undefined) {
      setTargetType("item");
      setTargetId(filterMenuItemId);
    } else {
      setTargetType("category");
      setTargetId("");
    }
    setSelectionType("single");
    setMaxSelections("");
    setIsRequired(true);
    setGroupFormError(null);
    setIsGroupModalOpen(true);
  }

  function openEditGroupModal(group: OptionGroupDto) {
    setEditingGroup(group);
    setGroupName(group.name);
    setTargetType(group.categoryId ? "category" : "item");
    setTargetId(group.categoryId ?? group.menuItemId ?? "");
    setSelectionType(group.selectionType);
    setMaxSelections(group.maxSelections != null ? String(group.maxSelections) : "");
    setIsRequired(group.required);
    setGroupFormError(null);
    setIsGroupModalOpen(true);
  }

  async function handleSaveGroup(e: FormEvent) {
    e.preventDefault();
    if (!editingGroup && !targetId) {
      setGroupFormError(targetType === "category" ? "Escolha uma categoria." : "Escolha um produto.");
      return;
    }
    let maxSelectionsValue: number | undefined;
    if (selectionType === "multiple") {
      maxSelectionsValue = Number(maxSelections);
      if (!Number.isInteger(maxSelectionsValue) || maxSelectionsValue < 1) {
        setGroupFormError("Informe até quantas opções o cliente pode marcar (mínimo 1).");
        return;
      }
    }
    setIsSavingGroup(true);
    setGroupFormError(null);
    try {
      const response = await fetch(
        editingGroup ? `/api/v1/menu/option-groups/${editingGroup.id}` : "/api/v1/menu/option-groups",
        {
          method: editingGroup ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: groupName,
            ...(editingGroup
              ? {}
              : { categoryId: targetType === "category" ? targetId : undefined, menuItemId: targetType === "item" ? targetId : undefined }),
            selectionType,
            maxSelections: selectionType === "multiple" ? maxSelectionsValue : undefined,
            required: isRequired,
          }),
        },
      );
      const body: ApiSuccess<OptionGroupDto> | ApiError = await response.json();
      if (!response.ok || "error" in body) {
        setGroupFormError(
          ("error" in body && body.error?.message) ||
            `Não foi possível ${editingGroup ? "atualizar" : "criar"} o grupo.`,
        );
        return;
      }
      setGroups((prev) =>
        editingGroup
          ? prev.map((g) => (g.id === editingGroup.id ? { ...g, ...body.data } : g))
          : [...prev, body.data],
      );
      setIsGroupModalOpen(false);
      toast.success(editingGroup ? "Grupo atualizado." : "Grupo de opção criado.");
    } catch {
      setGroupFormError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setIsSavingGroup(false);
    }
  }

  async function handleDeleteGroup() {
    if (!deletingGroup) return;
    setIsDeletingGroup(true);
    try {
      const response = await fetch(`/api/v1/menu/option-groups/${deletingGroup.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body: ApiError = await response.json();
        toast.error(body.error?.message ?? "Não foi possível excluir o grupo.");
        return;
      }
      setGroups((prev) => prev.filter((g) => g.id !== deletingGroup.id));
      toast.success("Grupo excluído.");
    } catch {
      toast.error("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setIsDeletingGroup(false);
      setDeletingGroup(null);
    }
  }

  function openAddItemForm(groupId: string) {
    setAddingItemToGroupId(groupId);
    setItemName("");
    setItemPrice("");
    setItemFormError(null);
  }

  async function handleAddItem(e: FormEvent, groupId: string) {
    e.preventDefault();
    const priceDelta = Number(itemPrice.replace(",", "."));
    if (!itemName.trim()) {
      setItemFormError("Informe o nome da opção.");
      return;
    }
    if (Number.isNaN(priceDelta) || priceDelta < 0) {
      setItemFormError("Informe um valor válido (pode ser 0).");
      return;
    }
    setIsSavingItem(true);
    setItemFormError(null);
    try {
      const response = await fetch(`/api/v1/menu/option-groups/${groupId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: itemName, priceDelta }),
      });
      const body: ApiSuccess<OptionGroupItemDto> | ApiError = await response.json();
      if (!response.ok || "error" in body) {
        setItemFormError(("error" in body && body.error?.message) || "Não foi possível adicionar a opção.");
        return;
      }
      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, items: [...g.items, body.data] } : g)));
      setAddingItemToGroupId(null);
      toast.success("Opção adicionada.");
    } catch {
      setItemFormError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setIsSavingItem(false);
    }
  }

  async function handleDeleteItem() {
    if (!deletingItem) return;
    setIsDeletingItem(true);
    try {
      const response = await fetch(`/api/v1/menu/option-groups/${deletingItem.groupId}/items/${deletingItem.itemId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body: ApiError = await response.json();
        toast.error(body.error?.message ?? "Não foi possível excluir a opção.");
        return;
      }
      setGroups((prev) =>
        prev.map((g) =>
          g.id === deletingItem.groupId ? { ...g, items: g.items.filter((i) => i.id !== deletingItem.itemId) } : g,
        ),
      );
      toast.success("Opção excluída.");
    } catch {
      toast.error("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setIsDeletingItem(false);
      setDeletingItem(null);
    }
  }

  function targetLabel(group: OptionGroupDto): string {
    if (group.categoryId) {
      const category = categories.find((c) => c.id === group.categoryId);
      return `Categoria: ${category?.name ?? "—"}`;
    }
    const item = items.find((i) => i.id === group.menuItemId);
    return `Produto: ${item?.name ?? "—"}`;
  }

  // Parada técnica — reorganização do fluxo de Cardápio (2026-08-14): a
  // busca (`fetchGroups`) continua trazendo TODOS os grupos do
  // restaurante — o filtro é só de exibição, aqui. Manter a busca cheia
  // (em vez de mandar o filtro pro backend) foi escolha deliberada: mais
  // simples, e o volume de grupos por restaurante é baixo o bastante pra
  // não valer a pena uma rota nova só pra isso agora.
  const visibleGroups = groups.filter((group) => {
    if (filterCategoryId !== undefined) return group.categoryId === filterCategoryId;
    if (filterMenuItemId !== undefined) return group.menuItemId === filterMenuItemId;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        {!compact && (
          <p className="text-sm text-ds2-foreground-muted">
            Grupos de opção — ex.: &quot;Borda&quot;, &quot;Ponto da carne&quot;, &quot;Tamanho&quot;. Cada grupo define se o
            cliente escolhe 1 opção ou várias (com limite), e se é obrigatório ou opcional.
          </p>
        )}
        <Button onClick={openCreateGroupModal} size={compact ? "sm" : "md"} variant={compact ? "outline" : "primary"}>
          <Plus className="h-4 w-4" aria-hidden />
          Novo grupo
        </Button>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Spinner className="h-5 w-5" />
        </div>
      ) : visibleGroups.length === 0 ? (
        compact ? (
          <p className="text-xs text-ds2-foreground-muted">
            Nenhum grupo cadastrado ainda — ex.: borda, tamanho, complementos.
          </p>
        ) : (
          <EmptyState
            icon={Layers}
            title="Nenhum grupo de opção ainda"
            description='Crie o primeiro, ex.: "Borda", vinculado à categoria de pizzas.'
          />
        )
      ) : (
        <div className="flex flex-col gap-4">
          {visibleGroups.map((group) => (
            <div key={group.id} className="rounded-ds2-lg border border-ds2-border bg-ds2-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-ds2-foreground">{group.name}</h3>
                  {filterCategoryId === undefined && filterMenuItemId === undefined && (
                    <p className="text-xs text-ds2-foreground-muted">{targetLabel(group)}</p>
                  )}
                  <p className="text-xs text-ds2-foreground-muted">
                    {group.selectionType === "multiple"
                      ? `Múltipla escolha (até ${group.maxSelections})`
                      : "Escolha única"}
                    {" · "}
                    {group.required ? "Obrigatório" : "Opcional"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEditGroupModal(group)} aria-label="Editar grupo">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeletingGroup(group)} aria-label="Excluir grupo">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-1.5">
                {group.items.length === 0 && (
                  <p className="text-xs text-ds2-foreground-muted">Nenhuma opção cadastrada ainda.</p>
                )}
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-ds2-sm bg-ds2-background px-3 py-2 text-sm"
                  >
                    <span className="text-ds2-foreground">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-numeric text-ds2-foreground-muted">
                        {item.priceDelta > 0 ? `+${formatCurrency(item.priceDelta)}` : "Sem custo"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDeletingItem({ groupId: group.id, itemId: item.id, itemName: item.name })}
                        aria-label={`Excluir ${item.name}`}
                        className="text-ds2-foreground-muted hover:text-ds2-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {addingItemToGroupId === group.id ? (
                <form onSubmit={(e) => handleAddItem(e, group.id)} className="mt-3 flex flex-col gap-2">
                  {itemFormError && <Alert variant="destructive">{itemFormError}</Alert>}
                  <div className="flex gap-2">
                    <Input
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      placeholder="Ex.: Catupiry"
                      className="flex-1"
                      disabled={isSavingItem}
                    />
                    <Input
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                      placeholder="0,00"
                      inputMode="decimal"
                      className="w-24"
                      disabled={isSavingItem}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" isLoading={isSavingItem}>
                      Adicionar
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAddingItemToGroupId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              ) : (
                <Button variant="outline" size="sm" className="mt-3" onClick={() => openAddItemForm(group.id)}>
                  <ListPlus className="h-3.5 w-3.5" />
                  Adicionar opção
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={isGroupModalOpen}
        onClose={() => {
          if (!isSavingGroup) setIsGroupModalOpen(false);
        }}
        title={editingGroup ? "Editar grupo de opção" : "Novo grupo de opção"}
        description='Ex.: "Borda", "Ponto da carne", "Tamanho".'
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setIsGroupModalOpen(false)} disabled={isSavingGroup}>
              Cancelar
            </Button>
            <Button type="submit" form="create-option-group-form" isLoading={isSavingGroup}>
              {editingGroup ? "Salvar alterações" : "Criar grupo"}
            </Button>
          </>
        }
      >
        <form id="create-option-group-form" onSubmit={handleSaveGroup} className="flex flex-col gap-4 pb-2">
          {groupFormError && <Alert variant="destructive">{groupFormError}</Alert>}

          <FormField label="Nome do grupo">
            <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Ex.: Borda" required />
          </FormField>

          {/* Sistema de Opcionais, Fase 1 — o alvo (categoria/produto) só é
              definido na criação; trocar depois teria que decidir o que
              fazer com pedidos antigos que referenciam as opções deste
              grupo, fora do escopo. Por isso some ao editar. */}
          {!editingGroup && filterCategoryId === undefined && filterMenuItemId === undefined && (
            <>
              <FormField label="Vale para">
                <Select
                  value={targetType}
                  onChange={(e) => {
                    setTargetType(e.target.value as "category" | "item");
                    setTargetId("");
                  }}
                >
                  <option value="category">Uma categoria inteira</option>
                  <option value="item">Só 1 produto específico</option>
                </Select>
              </FormField>

              <FormField label={targetType === "category" ? "Categoria" : "Produto"}>
                <Select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {targetType === "category"
                    ? categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    : items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                </Select>
              </FormField>
            </>
          )}

          {/* Sistema de Opcionais, Fase 2 (2026-08-14). */}
          <FormField label="Tipo de seleção">
            <Select
              value={selectionType}
              onChange={(e) => setSelectionType(e.target.value as "single" | "multiple")}
            >
              <option value="single">Escolha única (ex.: borda, tamanho)</option>
              <option value="multiple">Múltipla escolha (ex.: adicionais)</option>
            </Select>
          </FormField>

          {selectionType === "multiple" && (
            <FormField label="Até quantas opções o cliente pode marcar">
              <Input
                value={maxSelections}
                onChange={(e) => setMaxSelections(e.target.value.replace(/\D/g, ""))}
                placeholder="Ex.: 3"
                inputMode="numeric"
                required
              />
            </FormField>
          )}

          <label className="flex items-center gap-2 text-sm text-ds2-foreground">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="h-4 w-4 accent-ds2-primary"
            />
            Cliente é obrigado a escolher pelo menos 1 opção deste grupo
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={deletingGroup !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingGroup(null);
        }}
        title="Excluir grupo de opção"
        description={`As opções dentro de "${deletingGroup?.name}" também serão excluídas. Não é possível desfazer.`}
        cancelLabel="Voltar"
        confirmLabel="Sim, excluir"
        variant="destructive"
        onConfirm={handleDeleteGroup}
        isConfirming={isDeletingGroup}
      />

      <ConfirmDialog
        open={deletingItem !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingItem(null);
        }}
        title="Excluir opção"
        description={`Excluir "${deletingItem?.itemName}"? Não é possível desfazer.`}
        cancelLabel="Voltar"
        confirmLabel="Sim, excluir"
        variant="destructive"
        onConfirm={handleDeleteItem}
        isConfirming={isDeletingItem}
      />
    </div>
  );
}
