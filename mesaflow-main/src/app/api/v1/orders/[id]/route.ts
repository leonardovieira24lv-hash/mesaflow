import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/orders/{id} — contrato seção 8.2
//
// A tela de Detalhes do Pedido se inscreve separadamente no canal Realtime
// `orders:id=eq.{id}` (helper `orderTrackingChannel`,
// `lib/realtime/channels.ts`) para refletir mudanças feitas por outro
// atendente simultaneamente — este endpoint serve só a carga inicial.
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { profile } = await requireSession();
    const supabase = await createClient();

    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, status, total_amount, notes, created_at, table:tables(id, name), order_items(id, menu_item_id, name, price, quantity, notes)",
      )
      .eq("id", id)
      .eq("restaurant_id", profile.restaurantId)
      .maybeSingle();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível carregar o pedido.");
    }

    // RLS + o filtro por restaurant_id garantem que um pedido de outro
    // restaurante nunca aparece aqui — 404 comum para os dois casos, nunca
    // 403 (contrato seção 1.6: não revelar que o recurso existe).
    if (!order) {
      throw new AppError("NOT_FOUND", "Pedido não encontrado.");
    }

    // `orders.table_id` referencia uma única `tables` (many-to-one) — em
    // tempo de execução o PostgREST embute um objeto único, não uma lista.
    // O parsing estrutural da string de `select()` do postgrest-js infere
    // `table` (alias de `tables`) como array por padrão, então o compilador
    // via `order.table` como `{ id: any; name: any }[]`, sem `.id`/`.name` —
    // daí o cast explícito, mesmo padrão já usado em
    // `lib/dashboard/queries.ts` (`getRecentOrders`).
    const row = order as unknown as {
      id: string;
      status: string;
      total_amount: number;
      notes: string | null;
      created_at: string;
      table: { id: string; name: string } | null;
      order_items:
        | { id: string; menu_item_id: string; name: string; price: number; quantity: number; notes: string | null }[]
        | null;
    };

    return apiSuccess({
      id: row.id,
      table: { id: row.table?.id ?? "", name: row.table?.name ?? "—" },
      status: row.status,
      total_amount: row.total_amount,
      notes: row.notes ?? undefined,
      items: (row.order_items ?? []).map((item) => ({
        id: item.id,
        menu_item_id: item.menu_item_id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        notes: item.notes ?? undefined,
      })),
      created_at: row.created_at,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
