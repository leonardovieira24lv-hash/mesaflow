"use client";

import { useState, type DragEvent, type FormEvent } from "react";
import { Plus, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { CategorySection } from "@/components/cardapio/category-section";
import { ProductStatusFilter, type ProductStatusFilterValue } from "@/components/cardapio/product-status-filter";
import { ProductForm } from "@/components/cardapio/product-form";
import { CategoryImageUpload } from "@/components/cardapio/category-image-upload";
import { AcaiCategoryBuilder } from "@/components/cardapio/acai-category-builder";
import { PromoBannerUpload } from "@/components/configuracoes/promo-banner-upload";
import { deleteCategoryImage } from "@/lib/storage/category-images";
import { menuItemFromDto, type MenuItemDto } from "@/types/menu-item-dto";
import { createCategorySchema } from "@/lib/validations/menu";
import type { MenuCategory, MenuItem } from "@/types/domain";
import type { ApiError } from "@/types/api";
import { getMenuSetupGuide, getBusinessTypeLabel } from "@/lib/business-type";

interface CategoryDto {
  id: string;
  name: string;
  position: number;
  allowsHalfAndHalf: boolean;
  isCompact: boolean;
  imageUrl: string | null;
}

function categoryFromDto(dto: CategoryDto): MenuCategory {
  return {
    id: dto.id,
    name: dto.name,
    position: dto.position,
    allowsHalfAndHalf: dto.allowsHalfAndHalf,
    isCompact: dto.isCompact,
    imageUrl: dto.imageUrl,
  };
}

interface CardapioManagerProps {
  restaurantId: string;
  initialCategories: MenuCategory[];
  initialItems: MenuItem[];
  // Banner Promocional — movido de Configurações/Perfil pra cá
  // (2026-08-16, correção do dono: é conteúdo de cardápio, não de
  // perfil do restaurante).
  businessType: string | null;
  initialPromoBannerImageUrl: string | null;
  initialPromoBannerText: string | null;
  initialPromoBannerEnabled: boolean;
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
export function CardapioManager({
  restaurantId,
  initialCategories,
  initialItems,
  businessType,
  initialPromoBannerImageUrl,
  initialPromoBannerText,
  initialPromoBannerEnabled,
}: CardapioManagerProps) {
  // Parada técnica — reorganização do fluxo de Cardápio (2026-08-14):
  // existia uma aba "Grupos de opção" separada aqui (alternando com
  // "Cardápio") — removida. Opcionais agora vivem dentro do acordeão de
  // cada categoria (`category-section.tsx`), não precisam mais de estado
  // de aba nenhum neste componente.
  const [categories, setCategories] = useState<MenuCategory[]>(initialCategories);
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [openCategoryIds, setOpenCategoryIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilterValue>("active");

  // Banner Promocional (2026-08-16) — movido de Configurações/Perfil pra
  // cá. Salva direto no mesmo endpoint que Perfil já usa
  // (`PATCH /api/v1/restaurant`) — a tabela é a mesma (`restaurants`),
  // só o LUGAR na UI que mudou, não o dono do dado.
  const [promoBannerImageUrl, setPromoBannerImageUrl] = useState(initialPromoBannerImageUrl ?? "");
  const [promoBannerText, setPromoBannerText] = useState(initialPromoBannerText ?? "");
  const [promoBannerEnabled, setPromoBannerEnabled] = useState(initialPromoBannerEnabled);
  const [isSavingPromoBanner, setIsSavingPromoBanner] = useState(false);

  async function handleSavePromoBanner() {
    setIsSavingPromoBanner(true);
    try {
      const response = await fetch("/api/v1/restaurant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promo_banner_image_url: promoBannerImageUrl,
          promo_banner_text: promoBannerText,
          promo_banner_enabled: promoBannerEnabled,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        const apiError = body as ApiError;
        toast.error("Não foi possível salvar o banner", apiError.error?.message);
        return;
      }

      toast.success("Banner promocional salvo");
    } catch {
      toast.error("Não foi possível conectar", "Verifique sua internet e tente novamente.");
    } finally {
      setIsSavingPromoBanner(false);
    }
  }

  // Reordenação de categorias (drag-and-drop) — mesma lógica de sempre.
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Modal de categoria (criar/editar)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [categoryName, setCategoryName] = useState("");
  // Sistema de Opcionais, Fase 3 — meio a meio (2026-08-14). Confirmado
  // com o dono: ativação é por categoria inteira (ex.: "Pizzas"), não
  // produto por produto.
  const [categoryAllowsHalfAndHalf, setCategoryAllowsHalfAndHalf] = useState(false);
  // Layout compacto por categoria (2026-08-15) — mesmo raciocínio do
  // meio a meio: interruptor por categoria inteira, não travado no nome
  // "bebidas". Toda categoria marcada assim exibe seus produtos numa
  // grade 2 colunas, foto pequena, sem descrição, no Cardápio Público.
  const [categoryIsCompact, setCategoryIsCompact] = useState(false);
  // Foto de categoria (2026-08-15) — ideia do dono, inspirada num
  // concorrente: círculos com foto em vez de pílula de texto puro.
  // `originalCategoryImageUrl` guarda o valor com que o modal abriu, pra
  // saber se precisa apagar a imagem antiga do Storage depois de salvar
  // (mesmo raciocínio de `product-form.tsx`).
  const [categoryImageUrl, setCategoryImageUrl] = useState("");
  const [originalCategoryImageUrl, setOriginalCategoryImageUrl] = useState("");
  const [categoryFormError, setCategoryFormError] = useState<string | null>(null);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<MenuCategory | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  // Modal de produto (criar/editar)
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [productModalCategoryId, setProductModalCategoryId] = useState<string | undefined>(undefined);
  // Recaída do bug de 2026-07-29 (relatada pelo dono, 2026-08-15): o
  // `key` do <ProductForm> abaixo usava só `categoria` pra decidir se
  // precisava remontar — resolvia "trocar de categoria", mas criar um
  // 2º produto SEGUIDO na MESMA categoria gerava o mesmo `key` de antes,
  // então o React reaproveitava o formulário "vivo" com nome/preço do
  // produto anterior ainda preenchidos. Contador que sobe a cada abertura
  // (criar OU editar) garante um `key` sempre novo, mesmo repetindo
  // categoria — força remontagem de verdade toda vez.
  const [productModalNonce, setProductModalNonce] = useState(0);
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [duplicatingItemId, setDuplicatingItemId] = useState<string | null>(null);
  const [restoringItemId, setRestoringItemId] = useState<string | null>(null);
  const [isArchivingItem, setIsArchivingItem] = useState(false);

  const setupGuide = getMenuSetupGuide(businessType);

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
    setCategoryAllowsHalfAndHalf(false);
    setCategoryIsCompact(false);
    setCategoryImageUrl("");
    setOriginalCategoryImageUrl("");
    setCategoryFormError(null);
    setCategoryModalOpen(true);
  }

  function openEditCategoryModal(category: MenuCategory) {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryAllowsHalfAndHalf(category.allowsHalfAndHalf);
    setCategoryIsCompact(category.isCompact);
    setCategoryImageUrl(category.imageUrl ?? "");
    setOriginalCategoryImageUrl(category.imageUrl ?? "");
    setCategoryFormError(null);
    setCategoryModalOpen(true);
  }

  async function handleCategorySubmit(event: FormEvent) {
    event.preventDefault();
    setCategoryFormError(null);

    const result = createCategorySchema.safeParse({
      name: categoryName,
      allowsHalfAndHalf: categoryAllowsHalfAndHalf,
      isCompact: categoryIsCompact,
      imageUrl: categoryImageUrl,
    });
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
          body: JSON.stringify({
            name: result.data.name,
            allowsHalfAndHalf: result.data.allowsHalfAndHalf,
            isCompact: result.data.isCompact,
            imageUrl: result.data.imageUrl,
          }),
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

      // Mesmo raciocínio de `product-form.tsx`: só depois de salvar com
      // sucesso é que a imagem antiga (se trocada ou removida) é apagada
      // do Storage — best-effort, nunca bloqueia o fluxo.
      if (originalCategoryImageUrl && originalCategoryImageUrl !== saved.imageUrl) {
        void deleteCategoryImage(originalCategoryImageUrl);
      }

      // Açaí tem um fluxo próprio: a categoria representa um tipo de açaí
      // e, dentro do mesmo modal, o dono cadastra tamanhos/preços e depois
      // os complementos que servem para toda a categoria.
      if (businessType === "acai") {
        setEditingCategory(saved);
        setCategoryOpen(saved.id, true);
        toast.success(isEditing ? "Categoria atualizada" : "Categoria criada — agora cadastre os tamanhos.");
        setIsSavingCategory(false);
        return;
      }

      // Categorias dos demais nichos continuam com o fluxo universal atual.
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
    setProductModalNonce((n) => n + 1);
    setProductModalOpen(true);
  }

  function openEditProductModal(item: MenuItem) {
    setEditingItem(item);
    setProductModalCategoryId(undefined);
    setProductModalNonce((n) => n + 1);
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

  /**
   * Parada técnica — reorganização do fluxo de Cardápio (2026-08-14):
   * "Arquivar" mora dentro do mesmo modal de "Excluir" (não um ícone à
   * parte) — clica no lixo, o modal abre com as DUAS opções lado a lado,
   * escolhe uma. Reaproveita o mesmo `deletingItem` que já abre o modal;
   * reaproveita o mesmo `PATCH` de `handleRestoreProduct`, só invertido
   * (`is_archived: true`).
   */
  async function handleArchiveProduct() {
    if (!deletingItem) return;
    setIsArchivingItem(true);
    try {
      const response = await fetch(`/api/v1/menu/items/${deletingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_archived: true }),
      });
      const body = await response.json();

      if (!response.ok) {
        const apiError = body as ApiError;
        toast.error("Não foi possível arquivar", apiError.error?.message);
        return;
      }

      setItems((prev) => prev.map((i) => (i.id === deletingItem.id ? menuItemFromDto(body.data as MenuItemDto) : i)));
      toast.success("Produto arquivado", "Ele sai da lista de Ativos, mas pode ser restaurado quando quiser.");
      setDeletingItem(null);
    } catch {
      toast.error("Não foi possível conectar", "Verifique sua internet e tente novamente.");
    } finally {
      setIsArchivingItem(false);
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

      <Card className="border-ds2-primary/20 bg-ds2-primary/[0.03]">
        <CardHeader>
          <CardTitle>Como montar seu cardápio</CardTitle>
          <CardDescription>
            {setupGuide.title} · perfil: {getBusinessTypeLabel(businessType)}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-ds2-foreground">
          <p>{setupGuide.description}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-ds2-md bg-ds2-surface px-3 py-2 ring-1 ring-ds2-border">
              <p className="text-xs font-semibold uppercase tracking-wide text-ds2-foreground-muted">Categoria</p>
              <p className="mt-1 font-medium">{setupGuide.categoryExample}</p>
            </div>
            <div className="rounded-ds2-md bg-ds2-surface px-3 py-2 ring-1 ring-ds2-border">
              <p className="text-xs font-semibold uppercase tracking-wide text-ds2-foreground-muted">Produtos</p>
              <p className="mt-1 font-medium">{setupGuide.productExample}</p>
            </div>
            <div className="rounded-ds2-md bg-ds2-surface px-3 py-2 ring-1 ring-ds2-border">
              <p className="text-xs font-semibold uppercase tracking-wide text-ds2-foreground-muted">Opções</p>
              <p className="mt-1 font-medium">{setupGuide.optionExample}</p>
            </div>
          </div>
          <p className="text-xs text-ds2-foreground-muted">💡 {setupGuide.tip}</p>
        </CardContent>
      </Card>

      {/* Banner Promocional (2026-08-16) — movido de
          Configurações/Perfil pra cá: é conteúdo do cardápio (aparece no
          Cardápio Público, entre "Chamar garçom" e as categorias), não
          dado cadastral do restaurante. Mesmo padrão de card colapsável
          simples, sem modal — o dono normalmente mexe nisso 1x e não
          mais, não precisa de um fluxo separado de abrir/fechar. */}
      <Card>
        <CardHeader>
          <CardTitle>Banner Promocional</CardTitle>
          <CardDescription>
            Uma imagem de destaque no topo do cardápio — promoção do dia, evento, o que quiser.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex items-center justify-between gap-3 rounded-ds2-md bg-ds2-surface-hover px-4 py-3">
            <span className="flex flex-col">
              <span className="text-sm font-medium text-ds2-foreground">Exibir banner no cardápio</span>
              <span className="text-xs text-ds2-foreground-muted">
                Desligado, o cardápio fica exatamente como hoje — sem nenhum espaço reservado.
              </span>
            </span>
            <Switch
              checked={promoBannerEnabled}
              onChange={(e) => setPromoBannerEnabled(e.target.checked)}
              disabled={isSavingPromoBanner}
            />
          </label>

          <FormField label="Imagem">
            <PromoBannerUpload
              restaurantId={restaurantId}
              value={promoBannerImageUrl}
              onChange={setPromoBannerImageUrl}
              disabled={isSavingPromoBanner}
            />
          </FormField>

          <FormField
            label="Texto (opcional)"
            hint="Aparece sobre a imagem, embaixo. Até 200 caracteres. Deixe em branco pra mostrar só a imagem."
          >
            <Input
              value={promoBannerText}
              onChange={(e) => setPromoBannerText(e.target.value)}
              placeholder="Ex.: Oferta especial desta semana"
              disabled={isSavingPromoBanner}
              maxLength={200}
            />
          </FormField>

          <div className="flex justify-end">
            <Button type="button" onClick={handleSavePromoBanner} isLoading={isSavingPromoBanner}>
              Salvar banner
            </Button>
          </div>
        </CardContent>
      </Card>

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
              businessType={businessType}
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
        title={businessType === "acai" ? (editingCategory ? "Editar açaí" : "Novo açaí") : editingCategory ? "Editar categoria" : "Nova categoria"}
        description={businessType === "acai" ? "Cadastre o tipo de açaí, depois os tamanhos e os complementos que valem para toda essa categoria." : undefined}
      >
        <form onSubmit={handleCategorySubmit} noValidate className="flex flex-col gap-4 pb-6">
          <FormField label="Nome da categoria" error={categoryFormError ?? undefined} required>
            <Input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder={businessType === "acai" ? "Ex.: Açaí" : businessType === "pizza" ? "Ex.: Pizzas" : businessType === "burger" ? "Ex.: Hambúrgueres" : "Ex.: Lanches"}
              disabled={isSavingCategory}
              // Bug real encontrado (2026-07-29): o `autoFocus` do React
              // disputava com o próprio `<dialog>.showModal()`, que já foca
              // sozinho o primeiro elemento focável do modal assim que abre
              // — essa disputa de timing era a causa do campo "surdo" no
              // Android (foco e teclado abrem, mas a digitação não chega a
              // atualizar o valor controlado). Removido: o input continua
              // recebendo foco automaticamente pelo comportamento nativo do
              // `<dialog>`, sem o conflito.
            />
          </FormField>

          {/* Foto de categoria (2026-08-15) — ideia do dono, inspirada num
              concorrente: círculos com foto em vez de pílula de texto
              puro. Opcional de propósito, ver comentário do componente. */}
          <FormField label="Foto da categoria">
            <CategoryImageUpload
              restaurantId={restaurantId}
              value={categoryImageUrl}
              onChange={setCategoryImageUrl}
              disabled={isSavingCategory}
            />
          </FormField>

          {businessType !== "acai" && (
            <>
              <label className="flex items-center gap-2 text-sm text-ds2-foreground">
                <input
                  type="checkbox"
                  checked={categoryAllowsHalfAndHalf}
                  onChange={(e) => setCategoryAllowsHalfAndHalf(e.target.checked)}
                  disabled={isSavingCategory}
                  className="h-4 w-4 accent-ds2-primary"
                />
                Aceita meio a meio (cliente combina 2 opções da categoria)
              </label>

              <label className="flex items-center gap-2 text-sm text-ds2-foreground">
                <input
                  type="checkbox"
                  checked={categoryIsCompact}
                  onChange={(e) => setCategoryIsCompact(e.target.checked)}
                  disabled={isSavingCategory}
                  className="h-4 w-4 accent-ds2-primary"
                />
                Layout compacto (ideal para itens simples, como bebidas)
              </label>
            </>
          )}

          {businessType === "acai" && editingCategory && (
            <AcaiCategoryBuilder
              category={editingCategory}
              items={items}
              onItemsChange={setItems}
            />
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setCategoryModalOpen(false)} disabled={isSavingCategory}>
              {businessType === "acai" && editingCategory ? "Concluir" : "Cancelar"}
            </Button>
            <Button type="submit" isLoading={isSavingCategory}>
              {editingCategory ? "Salvar categoria" : "Criar categoria"}
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
          {/* Bug real encontrado (2026-07-29), recaída corrigida
              (2026-08-15): <ProductForm> nunca desmonta (fica sempre
              dentro do <Modal>, que existe permanentemente no DOM). O
              `key` antigo só considerava categoria/produto — criar 2
              produtos seguidos na MESMA categoria gerava o mesmo `key`,
              reaproveitando o formulário "vivo" com os dados do produto
              anterior ainda preenchidos. `productModalNonce` (sobe a
              cada abertura) garante um `key` sempre novo, mesmo
              repetindo categoria — força remontagem de verdade toda
              vez que o modal abre, criar ou editar. */}
          <ProductForm
            key={`${editingItem?.id ?? `new-${productModalCategoryId ?? "none"}`}-${productModalNonce}`}
            categories={categories}
            restaurantId={restaurantId}
            businessType={businessType}
            item={editingItem ?? undefined}
            defaultCategoryId={productModalCategoryId}
            onSaved={handleProductSaved}
            onCancel={() => setProductModalOpen(false)}
          />
        </div>
      </Modal>

      {/* Parada técnica — reorganização do fluxo de Cardápio (2026-08-14):
          antes era um `<ConfirmDialog>` genérico só com Excluir. Agora tem
          3 caminhos — Cancelar, Arquivar (tira de Ativos sem apagar nada,
          novo) e Excluir (apaga de vez, ou arquiva sozinho se já tiver
          pedido no histórico — comportamento antigo, intacto). Não usa
          `<ConfirmDialog>` porque esse componente só sabe fazer 2 botões
          (cancelar/confirmar) — é usado em vários outros lugares do app
          (excluir categoria, cancelar pedido) que continuam com 2 botões
          normalmente; só aqui precisava de um terceiro caminho. */}
      <Modal
        open={Boolean(deletingItem)}
        onClose={() => {
          if (!isDeletingItem && !isArchivingItem) setDeletingItem(null);
        }}
        title="Excluir ou arquivar produto"
        description={`O que fazer com "${deletingItem?.name}"? Arquivar tira da lista de Ativos sem apagar nada — dá pra restaurar depois. Excluir apaga de vez (a menos que já tenha pedido no histórico, aí é arquivado automaticamente).`}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setDeletingItem(null)}
              disabled={isDeletingItem || isArchivingItem}
            >
              Cancelar
            </Button>
            <Button variant="secondary" onClick={handleArchiveProduct} isLoading={isArchivingItem} disabled={isDeletingItem}>
              Arquivar
            </Button>
            <Button variant="destructive" onClick={handleDeleteProduct} isLoading={isDeletingItem} disabled={isArchivingItem}>
              Excluir
            </Button>
          </>
        }
      />
    </div>
  );
}
