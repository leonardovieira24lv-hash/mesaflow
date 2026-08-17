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
        "id, status, total_amount, notes, created_at, order_session_id, table:tables(id, name), order_items(id, menu_item_id, name, price, quantity, notes, cancelled_at, selected_options, half_and_half)",
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
      order_session_id: string | null;
      table: { id: string; name: string } | null;
      order_items:
        | {
            id: string;
            menu_item_id: string;
            name: string;
            price: number;
            quantity: number;
            notes: string | null;
            cancelled_at: string | null;
            // Sistema de Opcionais, Fase 1 (2026-08-14) — gravado por
            // create-order.ts como { group_name, option_name, price_delta }[],
            // ou null quando o produto não tinha opção aplicável.
            selected_options: { group_name: string; option_name: string; price_delta: number }[] | null;
            // Sistema de Opcionais, Fase 3 — meio a meio (2026-08-15).
            // Gravado por create-order.ts, `null` em todo item comum
            // (a grande maioria) — só presente quando o pedido combinou 2
            // sabores diferentes (pizza inteira de 1 sabor não grava isto,
            // é só um produto comum).
            half_and_half: { flavor_a_name: string; flavor_a_price: number; flavor_b_name: string; flavor_b_price: number } | null;
          }[]
        | null;
    };

    // Correção (2026-08-17, dono pediu que "Ver histórico da mesa" trocasse
    // de conteúdo dentro do MESMO drawer da mesa em vez de navegar pra
    // `/pedidos/{id}` como página cheia — histórico doloroso de bugs com
    // `<dialog>` aninhado descartou a opção de abrir um 2º modal por cima).
    // Este GET, que já existia só pra carga inicial da tela de Detalhes do
    // Pedido, ganhou `siblingOrders` — MESMA busca que `pedidos/[id]/page.tsx`
    // já fazia (mesmo `order_session_id`, todos os status, exceto ele
    // mesmo) — agora disponível também via fetch client-side, pro drawer
    // de Mesas reaproveitar sem duplicar a query em outro lugar.
    let siblingOrders: unknown[] = [];
    if (row.order_session_id) {
      const { data: siblings } = await supabase
        .from("orders")
        .select(
          "id, status, total_amount, notes, created_at, table:tables(id, name), order_items(id, menu_item_id, name, price, quantity, notes, cancelled_at, selected_options, half_and_half)",
        )
        .eq("order_session_id", row.order_session_id)
        .eq("restaurant_id", profile.restaurantId)
        .neq("id", row.id)
        .order("created_at", { ascending: false });

      siblingOrders = ((siblings ?? []) as unknown as (typeof row)[]).map((sibling) => ({
        id: sibling.id,
        table: { id: sibling.table?.id ?? "", name: sibling.table?.name ?? "—" },
        status: sibling.status,
        total_amount: sibling.total_amount,
        notes: sibling.notes ?? undefined,
        items: (sibling.order_items ?? []).map((item) => ({
          id: item.id,
          menu_item_id: item.menu_item_id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          notes: item.notes ?? undefined,
          cancelled_at: item.cancelled_at,
          selected_options: item.selected_options ?? undefined,
          half_and_half: item.half_and_half ?? undefined,
        })),
        created_at: sibling.created_at,
      }));
    }

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
        cancelled_at: item.cancelled_at,
        selected_options: item.selected_options ?? undefined,
        half_and_half: item.half_and_half ?? undefined,
      })),
      created_at: row.created_at,
      siblingOrders,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
