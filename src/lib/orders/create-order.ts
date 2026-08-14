import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/api/errors";
import type { CreateOrderInput } from "@/lib/validations/orders";
import type { OrderStatus } from "@/types/domain";

type AdminClient = ReturnType<typeof createAdminClient>;

interface CreatePublicOrderParams {
  admin: AdminClient;
  restaurantId: string;
  tableId: string;
  input: CreateOrderInput;
}

interface CreatedOrderSummary {
  id: string;
  // Sprint 1 de Correção: numa resposta de replay idempotente (ver
  // abaixo), o pedido pode já ter avançado de status desde a criação
  // original — devolver sempre "pending" aqui seria mentir sobre o estado
  // real do pedido.
  status: OrderStatus;
  total_amount: number;
}

interface MenuItemRow {
  id: string;
  category_id: string;
  name: string;
  price: number;
  is_available: boolean;
  is_archived: boolean;
}

interface OptionGroupItemRow {
  id: string;
  name: string;
  price_delta: number;
  option_group_id: string;
  option_groups: { id: string; name: string; category_id: string | null; menu_item_id: string | null } | null;
}

/**
 * Cria um pedido do cliente (contrato seção 3.3), revalidando preço e
 * disponibilidade no servidor — nunca confiando no que o front-end carregou
 * antes ("no momento do envio", seção 3.3). `price`/`total_amount` são
 * sempre calculados aqui a partir de `menu_items.price` atual; o payload do
 * cliente nunca carrega preço, então não há "preço divergente" possível do
 * lado do servidor — só disponibilidade, que é o que de fato se valida.
 *
 * Sprint "Correção — Fonte Única de Verdade no Carregamento do Modal"
 * (2026-07-30): a causa de "order_items chega vazio no fechamento de
 * conta" era uma policy de RLS não-correlacionada em `order_items`
 * (corrigida na migration 0022) — a instrumentação temporária usada para
 * achar isso já foi removida daqui, do POST público e do `GET` de
 * `close-bill`.
 */
export async function createPublicOrder({
  admin,
  restaurantId,
  tableId,
  input,
}: CreatePublicOrderParams): Promise<CreatedOrderSummary> {
  // Sprint 1 de Correção (Fase de Estabilização): replay idempotente. Se o
  // cliente já enviou esta mesma tentativa de checkout antes (retry por
  // timeout de rede, não um novo pedido intencional), devolve o pedido que
  // já existe em vez de criar um segundo. Não revalida itens nem reabre
  // sessão — o pedido original já passou por tudo isso; um replay só
  // precisa devolver o que já foi decidido.
  if (input.idempotency_key) {
    const { data: existing, error: existingError } = await admin
      .from("orders")
      .select("id, status, total_amount")
      .eq("restaurant_id", restaurantId)
      .eq("idempotency_key", input.idempotency_key)
      .maybeSingle();

    if (existingError) {
      // Sprint "Corrigir o fluxo de confirmação do pedido" — causa raiz
      // encontrada: `existingError.code === "42703"` é o código do Postgres
      // para "coluna não existe" (undefined_column). Isso acontece se a
      // migration 0008 (que adiciona `idempotency_key` a `orders`) ainda não
      // tiver sido aplicada à instância real do Supabase — mesma classe de
      // problema já encontrada nas últimas investigações (migrations mais
      // recentes nem sempre presentes no banco de verdade). Como
      // `idempotency_key` é só uma proteção contra duplicidade em retry de
      // rede — uma otimização, não o pedido em si — bloquear TODO pedido
      // por causa da ausência dessa coluna é desproporcional: trata esse
      // erro específico como "nenhum pedido existente encontrado" e segue o
      // fluxo normal (sem proteção de idempotência até a migration ser
      // aplicada, mas o cliente consegue pedir). Qualquer OUTRO erro de
      // banco continua bloqueando o pedido, como antes — só este código de
      // erro específico tem esse desvio.
      if (existingError.code !== "42703") {
        throw new AppError("INTERNAL_ERROR", "Não foi possível verificar o pedido.");
      }
      console.error(
        "[create-order] coluna orders.idempotency_key não existe ainda — aplique a migration 0008. Prosseguindo sem checagem de idempotência.",
      );
    } else if (existing) {
      return { id: existing.id, status: existing.status as OrderStatus, total_amount: existing.total_amount };
    }
  }

  const menuItemIds = [...new Set(input.items.map((item) => item.menu_item_id))];

  const { data: menuItems, error: menuItemsError } = await admin
    .from("menu_items")
    .select("id, category_id, name, price, is_available, is_archived")
    .eq("restaurant_id", restaurantId)
    .in("id", menuItemIds);

  if (menuItemsError) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível validar os itens do pedido.");
  }

  const menuItemById = new Map<string, MenuItemRow>((menuItems ?? []).map((item) => [item.id, item]));

  // Contrato 3.3: cada `menu_item_id` deve existir, pertencer a este
  // restaurante e estar `is_available = true` agora — qualquer item ausente
  // ou indisponível vira `422 STALE_PRICE_OR_AVAILABILITY`, com `details`
  // listando exatamente quais (mesmo já previsto na tela de Carrinho).
  //
  // Sprint "Exclusão Lógica de Produtos" (2026-07-28): produto arquivado
  // (excluído pelo dono) trata-se aqui como "não existe mais" — mesmo
  // texto de erro de um item ausente, já que do ponto de vista do cliente
  // é exatamente isso: não está mais no cardápio, arquivado ou apagado de
  // verdade dá na mesma.
  const staleDetails = input.items
    .filter((item) => {
      const menuItem = menuItemById.get(item.menu_item_id);
      return !menuItem || menuItem.is_archived || !menuItem.is_available;
    })
    .map((item) => {
      const menuItem = menuItemById.get(item.menu_item_id);
      return {
        field: item.menu_item_id,
        issue:
          menuItem && !menuItem.is_archived && !menuItem.is_available
            ? "Este item ficou indisponível."
            : "Este item não existe mais no cardápio.",
      };
    });

  if (staleDetails.length > 0) {
    throw new AppError(
      "STALE_PRICE_OR_AVAILABILITY",
      "Alguns itens do pedido mudaram desde que o cardápio foi carregado. Revise o carrinho.",
      staleDetails,
    );
  }

  // Sistema de Opcionais, Fase 1 (2026-08-14) — resolve as opções
  // escolhidas (ids) contra o banco: nome e `price_delta` sempre vêm
  // daqui, nunca do que o cliente mandou. Uma única busca pra todos os
  // ids de todos os itens do pedido, evitando 1 consulta por item.
  const allSelectedOptionIds = [...new Set(input.items.flatMap((item) => item.selected_option_ids ?? []))];

  const optionItemById = new Map<string, OptionGroupItemRow>();
  if (allSelectedOptionIds.length > 0) {
    const { data: optionItems, error: optionItemsError } = await admin
      .from("option_group_items")
      .select("id, name, price_delta, option_group_id, option_groups(id, name, category_id, menu_item_id)")
      .in("id", allSelectedOptionIds);

    if (optionItemsError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível validar as opções escolhidas.");
    }

    for (const row of (optionItems ?? []) as unknown as OptionGroupItemRow[]) {
      optionItemById.set(row.id, row);
    }
  }

  // Só aceita uma opção escolhida se o grupo dela realmente se aplica a
  // ESTE produto (o mesmo `menu_item_id`, ou a categoria do produto) —
  // qualquer id que não bater (adulterado, de outro restaurante, de um
  // grupo que não tem nada a ver com este produto) é silenciosamente
  // ignorado, não derruba o pedido inteiro.
  function resolveSelectedOptions(
    item: { menu_item_id: string; selected_option_ids?: string[] },
    menuItem: MenuItemRow,
  ) {
    return (item.selected_option_ids ?? [])
      .map((optionId) => optionItemById.get(optionId))
      .filter((row): row is OptionGroupItemRow => {
        if (!row?.option_groups) return false;
        const group = row.option_groups;
        return group.menu_item_id === menuItem.id || group.category_id === menuItem.category_id;
      })
      .map((row) => ({
        group_name: row.option_groups!.name,
        option_name: row.name,
        price_delta: row.price_delta,
      }));
  }

  const orderItemsToInsert = input.items.map((item) => {
    // Non-null: todo `menu_item_id` já passou pela checagem acima.
    const menuItem = menuItemById.get(item.menu_item_id)!;
    const selectedOptions = resolveSelectedOptions(item, menuItem);
    const optionsPriceDelta = selectedOptions.reduce((sum, o) => sum + o.price_delta, 0);
    return {
      menu_item_id: menuItem.id,
      name: menuItem.name,
      price: menuItem.price + optionsPriceDelta,
      quantity: item.quantity,
      notes: item.notes || null,
      selected_options: selectedOptions.length > 0 ? selectedOptions : null,
    };
  });

  const totalAmount = orderItemsToInsert.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Contrato 3.3: "order_sessions (criação, se não houver uma sessão aberta
  // para a mesa)" — reaproveita a sessão em aberto se existir, em vez de
  // sempre abrir uma nova (uma mesa pode receber vários pedidos na mesma
  // visita antes de fechar a conta — contrato 3.1: "active_order").
  //
  // Sprint 1 de Correção: entre o SELECT e o INSERT abaixo não há
  // transação — duas requisições concorrentes para a mesma mesa podiam
  // ambas ler "nenhuma sessão aberta" e inserir uma cada, fragmentando a
  // comanda. A migration 0008 adiciona um índice único (uma sessão aberta
  // por mesa); a segunda inserção concorrente agora falha com `23505`, e em
  // vez de propagar esse erro, reconsultamos a sessão que a outra
  // requisição acabou de criar e seguimos com ela.
  const { data: openSession, error: openSessionError } = await admin
    .from("order_sessions")
    .select("id")
    .eq("table_id", tableId)
    .is("closed_at", null)
    .maybeSingle();

  if (openSessionError) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível verificar a sessão da mesa.");
  }

  let orderSessionId: string | null = openSession?.id ?? null;

  if (!orderSessionId) {
    const { data: newSession, error: newSessionError } = await admin
      .from("order_sessions")
      .insert({ restaurant_id: restaurantId, table_id: tableId })
      .select("id")
      .single();

    if (newSessionError?.code === "23505") {
      // Outra requisição venceu a corrida e já criou a sessão aberta desta
      // mesa entre o nosso SELECT e este INSERT — busca a que existe agora.
      const { data: raceWinnerSession, error: raceWinnerError } = await admin
        .from("order_sessions")
        .select("id")
        .eq("table_id", tableId)
        .is("closed_at", null)
        .maybeSingle();

      if (raceWinnerError || !raceWinnerSession) {
        throw new AppError("INTERNAL_ERROR", "Não foi possível abrir a comanda da mesa.");
      }
      orderSessionId = raceWinnerSession.id;
    } else if (newSessionError || !newSession) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível abrir a comanda da mesa.");
    } else {
      orderSessionId = newSession.id;
    }
  }

  let { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      restaurant_id: restaurantId,
      table_id: tableId,
      order_session_id: orderSessionId,
      status: "pending",
      total_amount: totalAmount,
      notes: input.notes || null,
      idempotency_key: input.idempotency_key ?? null,
    })
    .select("id, status, total_amount")
    .single();

  if (orderError?.code === "42703") {
    // Mesma causa raiz do desvio na checagem de idempotência acima: a
    // coluna `idempotency_key` (migration 0008) pode não existir ainda
    // nesta instância do Supabase. Tenta de novo sem ela — o pedido em si
    // não depende dessa coluna para existir, só a proteção extra contra
    // duplicidade em retry de rede é que fica temporariamente indisponível.
    console.error(
      "[create-order] INSERT com idempotency_key falhou (coluna ausente) — tentando novamente sem ela. Aplique a migration 0008.",
    );
    ({ data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        restaurant_id: restaurantId,
        table_id: tableId,
        order_session_id: orderSessionId,
        status: "pending",
        total_amount: totalAmount,
        notes: input.notes || null,
      })
      .select("id, status, total_amount")
      .single());
  }

  if (orderError || !order) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível registrar o pedido. Tente novamente.");
  }

  const { error: orderItemsError } = await admin
    .from("order_items")
    .insert(orderItemsToInsert.map((item) => ({ ...item, order_id: order.id })));

  if (orderItemsError) {
    // O cliente supabase-js não expõe transação explícita para o service
    // role fora de uma função Postgres (RPC) — melhor esforço de rollback
    // manual aqui para não deixar um pedido "fantasma" sem itens. Se isto se
    // tornar um ponto de falha recorrente em produção, vale migrar a
    // criação inteira para uma função `SECURITY DEFINER` atômica.
    await admin.from("orders").delete().eq("id", order.id);
    throw new AppError(
      "INTERNAL_ERROR",
      "Não foi possível registrar os itens do pedido. Tente novamente.",
    );
  }

  // Sprint 1 de Correção — bug crítico da auditoria: nada gravava
  // `tables.status = 'ocupada'` quando um pedido real era criado pelo
  // cliente via QR Code. O painel de Mesas prioriza `table.status` sobre os
  // dados agregados de pedido (`deriveTableCardState`), então uma mesa podia
  // ter um pedido ativo e continuar aparecendo como "Livre" indefinidamente,
  // até um humano lembrar de editar o status manualmente. Só atualiza se o
  // status atual for "livre" — nunca sobrescreve "manutencao" (uma mesa em
  // manutenção não devia sequer ter chegado até aqui, ver
  // `resolveTableByToken`, mas por segurança não tocamos nesse caso) nem
  // reafirma "ocupada" à toa quando a mesa já está ocupada.
  const { error: tableStatusError } = await admin
    .from("tables")
    .update({ status: "ocupada" })
    .eq("id", tableId)
    .eq("status", "livre");

  if (tableStatusError) {
    // Best-effort: o pedido já foi criado com sucesso e é isso que importa
    // para o cliente. Se isto falhar, a mesa fica visualmente desatualizada
    // no painel até uma edição manual — não crítico o bastante para fazer o
    // pedido inteiro falhar por causa de um UPDATE cosmético.
    console.error("[create-order] falha ao marcar mesa como ocupada", tableStatusError);
  }

  return {
    id: order.id,
    status: "pending",
    total_amount: order.total_amount,
  };
}
