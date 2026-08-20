import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/api/errors";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface PublicOptionGroupItem {
  id: string;
  name: string;
  priceDelta: number;
}

export interface PublicOptionGroup {
  id: string;
  name: string;
  // Sistema de Opcionais, Fase 2 (2026-08-14) — ausentes = grupo da Fase 1
  // (nunca acontece de verdade: migration 0037 preenche default em todo
  // grupo já existente, mas o tipo aceita ausência por segurança).
  selectionType: "single" | "multiple";
  maxSelections: number | null;
  required: boolean;
  groupType: "standard" | "size";
  options: PublicOptionGroupItem[];
}

export interface PublicMenuItem {
  id: string;
  // Sistema de Opcionais, Fase 3 — meio a meio (2026-08-14). O modal do
  // produto precisa saber a categoria do item pra achar os "irmãos"
  // (outros produtos da mesma categoria) sem precisar de uma segunda
  // busca — o cardápio inteiro já chega numa chamada só, contrato 3.2.
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available: boolean;
  /**
   * Sistema de Opcionais, Fase 1 (2026-08-14) — grupos que se aplicam a
   * este produto: os vinculados diretamente a ele (`menu_item_id`) MAIS
   * os vinculados à categoria inteira (`category_id`) — os dois tipos
   * juntos, não um substituindo o outro. Vazio na grande maioria dos
   * produtos hoje (a maioria não tem opcional nenhum cadastrado ainda) —
   * o modal de produto só mostra a seção de opções quando este array não
   * está vazio.
   */
  optionGroups: PublicOptionGroup[];
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  // Sistema de Opcionais, Fase 3 — meio a meio (2026-08-14). Confirmado
  // com o dono: ativação por categoria inteira (ex.: "Pizzas"), não
  // produto por produto.
  allowsHalfAndHalf: boolean;
  // Layout compacto por categoria (2026-08-15) — mesmo raciocínio.
  isCompact: boolean;
  // Foto de categoria (2026-08-15) — `null` quando o dono não subiu
  // nenhuma. O fallback (foto do 1º produto → iniciais) é resolvido no
  // Cardápio Público (`category-nav.tsx`), não aqui — este campo é só o
  // valor cru do banco.
  imageUrl: string | null;
  /** Categoria cujos itens representam tamanhos/preços de um mesmo produto. */
  isSizeBased: boolean;
  items: PublicMenuItem[];
}

interface MenuItemRow {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
}

interface MenuCategoryRow {
  id: string;
  name: string;
  allows_half_and_half: boolean;
  is_compact: boolean;
  image_url: string | null;
}

interface OptionGroupRow {
  id: string;
  name: string;
  category_id: string | null;
  menu_item_id: string | null;
  selection_type: "single" | "multiple";
  max_selections: number | null;
  required: boolean;
  group_type: "standard" | "size";
  option_group_items: { id: string; name: string; price_delta: number }[];
}

/**
 * Monta o cardápio público (contrato seção 3.2): categorias ordenadas por
 * `position`, cada uma com seus produtos ordenados por nome. Produtos
 * indisponíveis nunca são filtrados aqui — Módulo 1: "produtos
 * indisponíveis devem aparecer desabilitados", quem decide a apresentação é
 * a UI (Fase 3), não o backend.
 *
 * Sprint "Exclusão Lógica de Produtos" (2026-07-28): produtos arquivados
 * (`is_archived = true` — excluídos pelo dono, mas com histórico de
 * pedidos preservado) são filtrados aqui, ao contrário de indisponíveis —
 * a diferença é proposital: indisponível é temporário e o cliente deve ver
 * (desabilitado); arquivado é definitivo e não deve aparecer de jeito
 * nenhum.
 *
 * Extraído de dentro do Route Handler (`api/v1/public/[slug]/menu/route.ts`)
 * nesta fase para que a Página do Cardápio (Server Component, mesmo padrão
 * já usado em todo o painel administrativo — ex.:
 * `app/(admin)/cardapio/produtos/page.tsx`, que consulta o Supabase
 * diretamente em vez de chamar sua própria API) reaproveite exatamente a
 * mesma query, em vez de duplicá-la. O comportamento e a resposta do
 * endpoint HTTP não mudaram — só a implementação interna foi movida para cá.
 *
 * Sistema de Opcionais, Fase 1 (2026-08-14): terceira busca em paralelo,
 * `option_groups` (com `option_group_items` aninhado). Usa o cliente
 * admin (mesmo dos outros dois) — ignora RLS de propósito, igual sempre:
 * cliente do Cardápio Público nunca tem sessão/perfil, a policy de
 * leitura de `option_groups` (`0036`) exige perfil autenticado, então só
 * funciona aqui porque o admin client não passa pela RLS.
 */
export async function getPublicMenu(
  admin: AdminClient,
  restaurantId: string,
): Promise<PublicMenuCategory[]> {
  const [categoriesResult, itemsResult, optionGroupsResult] = await Promise.all([
    admin
      .from("menu_categories")
      .select("id, name, position, allows_half_and_half, is_compact, image_url")
      .eq("restaurant_id", restaurantId)
      .order("position", { ascending: true }),
    admin
      .from("menu_items")
      .select("id, category_id, name, description, price, image_url, is_available")
      .eq("restaurant_id", restaurantId)
      .eq("is_archived", false)
      .order("name", { ascending: true }),
    admin
      .from("option_groups")
      .select(
        "id, name, category_id, menu_item_id, selection_type, max_selections, required, group_type, option_group_items(id, name, price_delta)",
      )
      .eq("restaurant_id", restaurantId),
  ]);

  if (categoriesResult.error || itemsResult.error || optionGroupsResult.error) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível carregar o cardápio.");
  }

  const itemsByCategory = new Map<string, MenuItemRow[]>();
  for (const item of (itemsResult.data ?? []) as MenuItemRow[]) {
    const bucket = itemsByCategory.get(item.category_id) ?? [];
    bucket.push(item);
    itemsByCategory.set(item.category_id, bucket);
  }

  const optionGroups = (optionGroupsResult.data ?? []) as OptionGroupRow[];

  function optionGroupsForItem(itemId: string, categoryId: string): PublicOptionGroup[] {
    return optionGroups
      .filter((group) => group.menu_item_id === itemId || group.category_id === categoryId)
      .map((group) => ({
        id: group.id,
        name: group.name,
        selectionType: group.selection_type,
        maxSelections: group.max_selections,
        required: group.required,
        groupType: group.group_type,
        options: group.option_group_items.map((option) => ({
          id: option.id,
          name: option.name,
          priceDelta: option.price_delta,
        })),
      }));
  }

  const categories = (categoriesResult.data ?? []) as MenuCategoryRow[];

  return categories.map((category) => {
    const categoryItems = [...(itemsByCategory.get(category.id) ?? [])];
    const sizePattern = /^\s*[0-9]+(?:[.,][0-9]+)?\s*(?:ml|l|litro|g|kg)\s*$/i;
    const isSizeBased =
      categoryItems.length > 0 && categoryItems.every((item) => sizePattern.test(item.name));

    const sortedItems = categoryItems.sort((a, b) => {
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
      return a.name.localeCompare(b.name, "pt-BR", {
        numeric: true,
        sensitivity: "base",
      });
    });

    return {
      id: category.id,
      name: category.name,
      allowsHalfAndHalf: category.allows_half_and_half,
      isCompact: category.is_compact,
      imageUrl: category.image_url,
      isSizeBased,
      items: sortedItems.map((item) => ({
        id: item.id,
        categoryId: category.id,
        name: item.name,
        description: item.description ?? undefined,
        price: item.price,
        image_url: item.image_url ?? undefined,
        is_available: item.is_available,
        optionGroups: optionGroupsForItem(item.id, category.id),
      })),
    };
  });
}
