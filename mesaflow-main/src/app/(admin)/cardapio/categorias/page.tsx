import { requirePageSession } from "@/lib/auth/require-page-session";
import { createClient } from "@/lib/supabase/server";
import { CategoriesManager } from "@/components/cardapio/categories-manager";
import type { MenuCategory } from "@/types/domain";

export const metadata = { title: "Categorias" };

/**
 * Cadastro de Categorias (contrato seção 5). Carrega a lista inicial aqui
 * (Server Component, mesmo padrão do Dashboard) e entrega para o
 * `<CategoriesManager>` — que é quem cuida de toda a interação (criar,
 * editar, excluir, reordenar por arrastar-e-soltar) via `/api/v1/menu/categories`.
 */
export default async function CategoriasPage() {
  const { profile } = await requirePageSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("menu_categories")
    .select("id, name, position")
    .eq("restaurant_id", profile.restaurantId)
    .order("position", { ascending: true });

  const categories: MenuCategory[] = (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    position: c.position,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold">Categorias</h1>
        <p className="text-sm text-muted-foreground">
          Organize o cardápio em categorias e arraste para definir a ordem de exibição para o cliente.
        </p>
      </div>

      <CategoriesManager initialCategories={categories} />
    </div>
  );
}
