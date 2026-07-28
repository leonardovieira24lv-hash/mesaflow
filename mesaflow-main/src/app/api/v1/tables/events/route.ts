import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseTableEventStatusFilter } from "@/lib/validations/table-events";
import type { TableEventStatus, TableEventType } from "@/types/domain";

// GET /api/v1/tables/events — docs/table-events-roadmap.md seção 2
//
// Nota de arquitetura: a especificação original descrevia esta leitura como
// `GET /api/v1/tables/{tableId}/events`, por mesa. Implementado aqui como
// restaurante inteiro (sem `tableId` na URL), na mesma forma de
// `GET /api/v1/orders` — porque é isso que a seção 4 do próprio documento
// pede de verdade ("TablesManager passa a buscar table_events, mesmo padrão
// de fetchOperations"): uma única chamada trazendo todos os eventos abertos
// do restaurante, agregados por mesa no cliente — não N chamadas, uma por
// mesa. Mantém a mesma ideia (`?status=`), só a rota fica plana em vez de
// aninhada, coerente com o resto da API administrativa.
export async function GET(request: Request) {
  try {
    const { profile } = await requireSession();
    const { searchParams } = new URL(request.url);
    const statusFilter = parseTableEventStatusFilter(searchParams.get("status"));

    const supabase = await createClient();

    let queryBuilder = supabase
      .from("table_events")
      .select("id, type, status, created_at, table:tables(id, name)")
      .eq("restaurant_id", profile.restaurantId);

    if (statusFilter) {
      queryBuilder = queryBuilder.eq("status", statusFilter);
    }

    const { data, error } = await queryBuilder.order("created_at", { ascending: false });

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível carregar os eventos das mesas.");
    }

    // Mesmo padrão de cast já usado em `api/v1/orders/route.ts`: o PostgREST
    // embute `table` (many-to-one) como objeto único em tempo de execução,
    // mas o parsing estrutural do `select()` do postgrest-js infere como
    // array por padrão.
    const rows = (data ?? []) as unknown as Array<{
      id: string;
      type: string;
      status: string;
      created_at: string;
      table: { id: string; name: string } | null;
    }>;

    return apiSuccess(
      rows.map((row) => ({
        id: row.id,
        table: { id: row.table?.id ?? "", name: row.table?.name ?? "—" },
        type: row.type as TableEventType,
        status: row.status as TableEventStatus,
        createdAt: row.created_at,
      })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
