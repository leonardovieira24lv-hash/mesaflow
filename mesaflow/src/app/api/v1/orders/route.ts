import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { listOrdersQuerySchema, parseOrderStatusFilter } from "@/lib/validations/orders";

// GET /api/v1/orders — contrato seção 8.1
//
// Alimenta a carga inicial da tela de Pedidos em Tempo Real (Módulo 5) — as
// atualizações seguintes chegam via Supabase Realtime no canal
// `restaurant:{id}:orders` (helper `restaurantOrdersChannel`,
// `lib/realtime/channels.ts`), sem nova chamada a este endpoint (Módulo 7).
export async function GET(request: Request) {
  try {
    const { profile } = await requireSession();
    const { searchParams } = new URL(request.url);

    const query = parseOrThrow(listOrdersQuerySchema, {
      page: searchParams.get("page") ?? undefined,
      per_page: searchParams.get("per_page") ?? undefined,
    });
    const statusFilter = parseOrderStatusFilter(searchParams.get("status"));

    const supabase = await createClient();

    let queryBuilder = supabase
      .from("orders")
      .select("id, status, total_amount, created_at, table:tables(id, name), order_items(count)", {
        count: "exact",
      })
      .eq("restaurant_id", profile.restaurantId);

    if (statusFilter && statusFilter.length > 0) {
      queryBuilder = queryBuilder.in("status", statusFilter);
    }

    const from = (query.page - 1) * query.per_page;
    const to = from + query.per_page - 1;

    // Módulo 5: "ordenação mais recentes primeiro" — único critério previsto
    // para esta tela (contrato 8.1 não expõe `?sort=` aqui).
    const { data, error, count } = await queryBuilder
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível carregar os pedidos.");
    }

    const total = count ?? 0;

    // `orders.table_id` referencia uma única `tables` (many-to-one) — em
    // tempo de execução o PostgREST embute um objeto único, não uma lista.
    // O parsing estrutural da string de `select()` do postgrest-js infere
    // `table` (alias de `tables`) como array por padrão, então o compilador
    // via `row.table` como `{ id: any; name: any }[]`, sem `.id`/`.name` —
    // daí o cast explícito, mesmo padrão já usado em
    // `lib/dashboard/queries.ts` (`getRecentOrders`).
    const rows = (data ?? []) as unknown as Array<{
      id: string;
      status: string;
      total_amount: number;
      created_at: string;
      table: { id: string; name: string } | null;
      order_items: { count: number }[] | null;
    }>;

    return apiSuccess(
      rows.map((row) => ({
        id: row.id,
        table: { id: row.table?.id ?? "", name: row.table?.name ?? "—" },
        status: row.status,
        total_amount: row.total_amount,
        item_count: row.order_items?.[0]?.count ?? 0,
        created_at: row.created_at,
      })),
      {
        meta: {
          page: query.page,
          per_page: query.per_page,
          total,
          total_pages: Math.max(1, Math.ceil(total / query.per_page)),
        },
      },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
