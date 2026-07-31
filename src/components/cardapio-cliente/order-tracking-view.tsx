"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { RestaurantHeader } from "@/components/cardapio-cliente/restaurant-header";
import { OrderStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
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
    <div className="flex min-h-screen flex-col animate-fade-in">
      <RestaurantHeader restaurantName={restaurantName} />

      <main className="flex flex-1 flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-xl font-semibold text-foreground">Sua comanda</h1>
        </div>

        {/* Resumo da comanda (Fase 4) — total parcial, quantidade de
            pedidos e de itens, tudo derivado dos mesmos `orders` que
            alimentam a timeline abaixo, sem consulta própria. */}
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total parcial</span>
          <span className="font-numeric text-2xl font-bold text-foreground">{formatCurrency(totalAmount)}</span>
          <div className="mt-1 flex items-center gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
            <span>
              {orders.length} {orders.length === 1 ? "pedido" : "pedidos"}
            </span>
            <span aria-hidden>·</span>
            <span>
              {itemCount} {itemCount === 1 ? "item" : "itens"}
            </span>
          </div>
        </div>

        {tableToken && (
          <ButtonLink href={withMesaQuery(ROUTES.clienteMenu(slug), tableToken)} className="w-full justify-center">
            <Sparkles className="h-4 w-4" />
            Continuar comprando
          </ButtonLink>
        )}

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-foreground">Pedidos desta comanda</h2>
          <ul className="flex flex-col gap-2">
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
                    "flex flex-col gap-2 rounded-lg border p-3 text-sm transition-colors",
                    isUnprocessed ? "border-primary/50 bg-primary/5" : "border-border bg-surface",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      Pedido #{orderNumberById.get(order.id)}
                      <span className="font-numeric text-xs font-normal text-muted-foreground">
                        · {formatTime(order.createdAt)}
                      </span>
                    </span>
                    <OrderStatusBadge status={order.status} />
                  </div>

                  <ul className="flex flex-col gap-0.5">
                    {order.items.map((item, index) => (
                      <li key={`${order.id}-${item.name}-${index}`} className="text-xs text-muted-foreground">
                        {item.quantity}× {item.name}
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
