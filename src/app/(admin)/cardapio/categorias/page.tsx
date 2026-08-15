import { requirePageSession } from "@/lib/auth/require-page-session";
import { createClient } from "@/lib/supabase/server";
import { CardapioManager } from "@/components/cardapio/cardapio-manager";
import type { MenuCategory, MenuItem } from "@/types/domain";

export const metadata = { title: "Cardápio" };

/**
 * Tela única de "Cardápio" (Sprint "Refatoração da Experiência do
 * Cardápio", 2026-07-28) — antes dividida em `/cardapio/categorias` e
 * `/cardapio/produtos`. Ficou nesta mesma rota (`/cardapio/categorias`)
 * porque é para onde a sidebar e o link "Categorias" do Dashboard já
 * apontavam; `/cardapio/produtos` virou um redirect pra cá (ver esse
 * arquivo) para não quebrar o segundo atalho do Dashboard — nada no
 * Dashboard em si foi tocado.
 *
 * Carrega categorias e **todos** os produtos do restaurante de uma vez
 * (mesma leitura direta ao Supabase que a página de Categorias já fazia,
 * e o mesmo select que a de Produtos fazia — só sem o `.range()` de
 * paginação, que só fazia sentido na tabela antiga). Toda interação
 * seguinte (criar, editar, excluir, duplicar, reordenar) acontece no
 * `<CardapioManager>`.
 *
 * Sprint "Arquivamento — Visualizar e Restaurar" (2026-07-28, sobre a
 * sprint "Exclusão Lógica de Produtos"): esta consulta voltou a trazer
 * produtos arquivados junto — o filtro Ativos/Arquivados/Todos precisa dos
 * dois conjuntos para alternar sem recarregar a página. A tela ainda abre
 * no filtro "Ativos" por padrão (mesmo efeito visual de antes), mas agora
 * o dado completo já está no cliente.
 */
export default async function CardapioPage() {
  const { profile } = await requirePageSession();
  const supabase = await createClient();

  const [categoriesResult, itemsResult] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, name, position, allows_half_and_half, is_compact")
      .eq("restaurant_id", profile.restaurantId)
      .order("position", { ascending: true }),
    supabase
      .from("menu_items")
      .select("id, category_id, name, description, price, image_url, is_available, is_archived")
      .eq("restaurant_id", profile.restaurantId)
      .order("name", { ascending: true }),
  ]);

  const categories: MenuCategory[] = (categoriesResult.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    position: c.position,
    allowsHalfAndHalf: c.allows_half_and_half,
    isCompact: c.is_compact,
  }));

  const items: MenuItem[] = (itemsResult.data ?? []).map((i) => ({
    id: i.id,
    categoryId: i.category_id,
    name: i.name,
    description: i.description ?? undefined,
    price: i.price,
    imageUrl: i.image_url ?? undefined,
    isAvailable: i.is_available,
    isArchived: i.is_archived,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold">Cardápio</h1>
        <p className="text-sm text-muted-foreground">
          Monte categorias e produtos num só lugar — crie uma categoria e já adicione os produtos dela na mesma tela.
        </p>
      </div>

      <CardapioManager restaurantId={profile.restaurantId} initialCategories={categories} initialItems={items} />
    </div>
  );
}
