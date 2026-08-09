"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { RestaurantHeader } from "@/components/cardapio-cliente/restaurant-header";
import { ROUTES } from "@/constants/routes";
import { withMesaQuery } from "@/lib/cliente-url";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PublicSessionOrder } from "@/lib/orders/get-public-session-orders";
import type { ApiSuccess } from "@/types/api";
import type { OrderStatus } from "@/types/domain";

interface OrderTrackingViewProps {
  slug: string;
  orderId: string;
  restaurantName: string;
  initialOrders: PublicSessionOrder[];
  /**
   * Sprint "Continuar Comprando" (2026-07-31): `token` da mesa, só quando
   * a `order_session` dela ainda está aberta (`getOrderTableContext`,
   * resolvido no Server Component) — controla se o botão de volta ao
   * cardápio aparece. `null` cobre tanto "sem mesa associada" quanto
   * "sessão já fechada" (conta paga, mesa liberada); nesses casos a tela
   * continua igual, só sem o botão.
   */
  tableToken: string | null;
}

const POLL_INTERVAL_MS = 5_000;
const TERMINAL_STATUSES: OrderStatus[] = ["delivered", "cancelled"];

/** Rótulo em português de cada status de pedido, para o cliente final. */
const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pedido realizado",
  preparing: "Em preparo",
  ready: "Pronto",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

/**
 * Cor de cada status no tema dark do Cardápio Público. Substitui o
 * `<OrderStatusBadge>` compartilhado (que renderizava sem estilo visível em
 * produção) — mesmos status, mesmos rótulos, só com aparência própria.
 */
const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  preparing: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  ready: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  delivered: "bg-zinc-700/60 text-zinc-300 ring-zinc-600",
  cancelled: "bg-red-500/15 text-red-300 ring-red-500/30",
};

/**
 * Tela "Sua comanda" — Sprint "Evolução da Área do Cliente (Comanda)"
 * (2026-07-31). Antes representava UM pedido; passa a representar a
 * COMANDA inteira (todos os pedidos da mesma `order_session`), pra deixar
 * explícito ao cliente que pedidos feitos em momentos diferentes da
 * refeição pertencem à mesma conta.
 *
 * Nota sobre "Realtime, caso disponível" (herdada, ainda válida): a
 * infraestrutura de Realtime já existe — a migration 0007 publica `orders`
 * no `supabase_realtime` — mas ela só é segura para uma conexão
 * AUTENTICADA (ver detalhes na versão anterior deste componente, no
 * histórico do repositório). Esta tela continua atualizando via *polling*,
 * agora no endpoint novo, por comanda
 * (`GET /api/v1/public/{slug}/orders/{orderId}/session`, sub-recurso do
 * contrato 3.4 — que continua existindo e inalterado, só não é mais quem
 * alimenta esta tela depois da carga inicial).
 *
 * O *polling* só para quando TODOS os pedidos da comanda estiverem num
 * status terminal — uma comanda pode ganhar pedidos novos a qualquer
 * momento ("Continuar comprando"), então "só este pedido terminou" não é
 * mais motivo suficiente pra parar de atualizar a tela toda.
 *
 * Sprint "Cardápio Dark/Premium" (2026-08-09): esta era a última tela do
 * fluxo público inteiramente CLARA (confirmado por captura de tela real) —
 * fundo branco, card branco e "Continuar comprando" como texto solto, no
 * meio de um produto já todo escuro. Causa: dependia dos tokens do design
 * system antigo (`bg-surface`, `border-border`, `text-foreground`,
 * `text-muted-foreground`, `font-numeric`, `animate-fade-in`) e dos
 * componentes compartilhados `<ButtonLink>`/`<OrderStatusBadge>`, que não
 * entregam aparência nenhuma em produção.
 *
 * Reconstrução visual, na mesma linguagem das outras telas:
 * - fundo `zinc-950` contínuo (`min-h-dvh`, era `min-h-screen`);
 * - card de "Total parcial" como peça premium: superfície `zinc-900`,
 *   rótulo em maiúsculas `zinc-500`, valor em 3xl branco (é a informação
 *   mais importante da tela), divisor e metadados abaixo;
 * - "Continuar comprando" virou PRIMARY BUTTON verde de verdade — é a
 *   única ação da tela, então merece o peso máximo;
 * - cada pedido virou card `zinc-900` com badge de status colorido por
 *   estado (verde/âmbar/azul/cinza/vermelho), em vez do badge sem estilo;
 * - itens do pedido em `zinc-400`, com o "N×" em branco para leitura rápida.
 *
 * Nenhuma lógica foi tocada: polling, `isTerminal`, `totalAmount`,
 * `itemCount`, `orderNumberById` e `formatTime` são idênticos.
 */
export function OrderTrackingView({ slug, orderId, restaurantName, initialOrders, tableToken }: OrderTrackingViewProps) {
  const [orders, setOrders] = useState<PublicSessionOrder[]>(initialOrders);
  const isTerminal = orders.every((order) => TERMINAL_STATUSES.includes(order.status));

  useEffect(() => {
    if (isTerminal) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/public/${slug}/orders/${orderId}/session`);
        if (!response.ok) return;

        const body = (await response.json()) as ApiSuccess<{ orders: PublicSessionOrder[] }>;
        setOrders(body.data.orders);
      } catch {
        // Falha de rede num poll isolado não é crítica — a tentativa seguinte
        // (5s depois) corrige sozinha; não há necessidade de mostrar erro por
        // uma única requisição perdida.
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [slug, orderId, isTerminal]);

  // Resumo da comanda — derivado da própria lista, nada guardado à parte.
  const totalAmount = useMemo(() => orders.reduce((sum, o) => sum + o.totalAmount, 0), [orders]);
  const itemCount = useMemo(
    () => orders.reduce((sum, o) => sum + o.items.reduce((s, item) => s + item.quantity, 0), 0),
    [orders],
  );

  // "Pedido #N" por ordem de chegada (mais antigo = #1) — numeração
  // ascendente é mais intuitiva que a posição na lista, que é decrescente
  // (mais recente primeiro) por pedido explícito da Fase 4. Cópia à parte,
  // ordenada de forma oposta à exibição, só pra calcular o número.
  const orderNumberById = useMemo(() => {
    const chronological = [...orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const map = new Map<string, number>();
    chronological.forEach((order, index) => map.set(order.id, index + 1));
    return map;
  }, [orders]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col bg-zinc-950 pb-8 sm:border-x sm:border-zinc-800">
      <RestaurantHeader restaurantName={restaurantName} />

      <main className="flex flex-1 flex-col gap-6 px-4 py-6">
        <h1 className="text-xl font-bold tracking-tight text-white">Sua comanda</h1>

        {/* Resumo da comanda (Fase 4) — total parcial, quantidade de
            pedidos e de itens, tudo derivado dos mesmos `orders` que
            alimentam a timeline abaixo, sem consulta própria. */}
        <div className="flex flex-col gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Total parcial</span>
          <span className="text-3xl font-extrabold tabular-nums tracking-tight text-white">
            {formatCurrency(totalAmount)}
          </span>
          <div className="mt-2.5 flex items-center gap-2 border-t border-zinc-800 pt-2.5 text-xs text-zinc-400">
            <span>
              {orders.length} {orders.length === 1 ? "pedido" : "pedidos"}
            </span>
            <span aria-hidden className="text-zinc-600">
              ·
            </span>
            <span>
              {itemCount} {itemCount === 1 ? "item" : "itens"}
            </span>
          </div>
        </div>

        {tableToken && (
          <Link
            href={withMesaQuery(ROUTES.clienteMenu(slug), tableToken)}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-base font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-600 active:scale-[0.98]"
          >
            <Sparkles className="h-4.5 w-4.5" strokeWidth={2.5} />
            Continuar comprando
          </Link>
        )}

        <div className="flex flex-col gap-2.5">
          <h2 className="text-sm font-semibold text-zinc-400">Pedidos desta comanda</h2>
          <ul className="flex flex-col gap-2.5">
            {orders.map((order) => {
              // Fase 4 ("destaque visual quando acabou de ser enviado"):
              // critério é `status === "pending"` — literalmente "ainda não
              // processado pela cozinha" — não um timer. Mesmo princípio já
              // usado no indicador do painel do garçom (`hasUnprocessedOrders`,
              // sprint anterior): o que importa é o pedido não ter sido
              // processado ainda, não há quanto tempo ele chegou.
              const isUnprocessed = order.status === "pending";

              return (
                <li
                  key={order.id}
                  className={cn(
                    "flex flex-col gap-2.5 rounded-2xl border p-4 text-sm transition-colors",
                    isUnprocessed ? "border-emerald-500/30 bg-emerald-500/[0.07]" : "border-zinc-800 bg-zinc-900",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-baseline gap-1.5 font-semibold text-white">
                      Pedido #{orderNumberById.get(order.id)}
                      <span className="text-xs font-normal tabular-nums text-zinc-500">
                        · {formatTime(order.createdAt)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
                        STATUS_STYLES[order.status],
                      )}
                    >
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>

                  <ul className="flex flex-col gap-1 border-t border-zinc-800/80 pt-2.5">
                    {order.items.map((item, index) => (
                      <li key={`${order.id}-${item.name}-${index}`} className="text-xs text-zinc-400">
                        <span className="font-semibold text-zinc-200">{item.quantity}×</span> {item.name}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </div>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
