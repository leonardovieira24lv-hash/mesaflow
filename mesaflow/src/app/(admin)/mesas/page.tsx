import { requirePageSession } from "@/lib/auth/require-page-session";
import { createClient } from "@/lib/supabase/server";
import { TablesManager } from "@/components/mesas/tables-manager";
import type { Table } from "@/types/domain";

export const metadata = { title: "Mesas" };

/**
 * Administração de Mesas e QR Codes (contrato seção 7). Carrega a lista
 * inicial + o slug do restaurante aqui (Server Component, mesmo padrão de
 * `(admin)/cardapio/categorias/page.tsx`) e entrega para o
 * `<TablesManager>` — que cuida de toda a interação (criar, editar,
 * excluir, alterar status, visualizar/baixar QR Code) via `/api/v1/tables`.
 *
 * O `slug` é lido direto do Supabase (não via `GET /api/v1/restaurant`) pelo
 * mesmo motivo já documentado no Dashboard: um Server Component fazer HTTP
 * para a própria API do mesmo app é um round-trip desnecessário — só é
 * necessário para exibir a URL codificada no QR Code de cada mesa, não é
 * uma escrita nem um dado consumido por outra superfície.
 */
export default async function MesasPage() {
  const { profile } = await requirePageSession();
  const supabase = await createClient();

  const [{ data: restaurant }, { data: tablesData }] = await Promise.all([
    supabase.from("restaurants").select("slug").eq("id", profile.restaurantId).single(),
    supabase
      .from("tables")
      .select("id, name, status, qr_token")
      .eq("restaurant_id", profile.restaurantId)
      .order("name", { ascending: true }),
  ]);

  const tables: Table[] = (tablesData ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    qrToken: t.qr_token,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold">Mesas</h1>
        <p className="text-sm text-muted-foreground">
          Adicione, renomeie e gerencie o status das mesas do salão, e baixe o QR Code de acesso ao
          cardápio de cada uma.
        </p>
      </div>

      <TablesManager initialTables={tables} restaurantSlug={restaurant?.slug ?? ""} />
    </div>
  );
}
