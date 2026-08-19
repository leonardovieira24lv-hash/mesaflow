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
  // Identidade — Sprint "Identidade do Restaurante no Cardápio Público"
  // (2026-08-09). Sem descrição aqui, por escopo (só o Cardápio mostra).
  restaurantLogoUrl?: string | null;
  // Etapa 2 — Propagação do Tema (2026-08-11). Mesma nota de
  // `cardapio-cliente-view.tsx`.
  menuTheme?: "light" | "dark";
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
  pending: "bg-soft-success text-soft-success-foreground ring-soft-success-ring",
  preparing: "bg-soft-warning text-soft-warning-foreground ring-soft-warning-ring",
  ready: "bg-soft-info text-soft-info-foreground ring-soft-info-ring",
  delivered: "bg-muted text-muted-foreground ring-border",
  cancelled: "bg-soft-danger text-soft-danger-foreground ring-soft-danger-ring",
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
 *
 * Etapa 3O — Migração para Tokens (2026-08-12): raiz, card "Total
 * parcial" e cards de pedido migraram pra token + `elevation-card` (mesmo
 * "3D" do resto do Cardápio). Os 5 `STATUS_STYLES` recalibrados pro claro
 * — cada um mantém o mesmo hue semântico (verde/âmbar/azul/cinza/
 * vermelho), só trocando de "tom translúcido sobre fundo escuro" pra
 * "fundo bem claro + texto escuro", mesmo raciocínio já aplicado no verde
 * do preço e nos avisos do checkout. "delivered" (neutro, sem hue
 * próprio) virou token puro (`bg-muted`/`text-muted-foreground`/
 * `border-border`) em vez de zinc literal. "Continuar comprando"
 * (emerald-500) e o destaque verde de pedido não processado
 * (emerald-500/30, emerald-500/[0.07]) preservados sem alteração.
 *
 * Correção (2026-08-12): observação por item ("sem cebola", etc.) nunca
 * aparecia aqui — a cadeia inteira (consulta em `getOrdersForSessions`,
 * `lib/tables/get-open-table-operations.ts` → `getPublicSessionOrders`,
 * `lib/orders/get-public-session-orders.ts` → este componente) descartava
 * o campo antes de chegar na tela, mesmo a cozinha recebendo certo por um
 * caminho diferente. Cliente confirmava com observação, via só o nome do
 * produto no acompanhamento, sem confirmação visual de que o pedido
 * específico foi registrado — risco real de achar que não funcionou e
 * chamar o garçom à toa. Corrigido na cadeia inteira, não só aqui.
 */
export function OrderTrackingView({ slug, orderId, restaurantName, restaurantLogoUrl, menuTheme, initialOrders, tableToken }: OrderTrackingViewProps) {
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
    <div
      className={cn(
        "mx-auto flex min-h-dvh max-w-xl flex-col bg-background pb-8 sm:border-x sm:border-border",
        menuTheme === "dark" && "menu-dark",
      )}
    >
      <RestaurantHeader restaurantName={restaurantName} logoUrl={restaurantLogoUrl} />

      <main className="flex flex-1 flex-col gap-6 px-4 py-6">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Sua comanda</h1>

        {/* Resumo da comanda (Fase 4) — total parcial, quantidade de
            pedidos e de itens, tudo derivado dos mesmos `orders` que
            alimentam a timeline abaixo, sem consulta própria. */}
        <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-surface p-5 elevation-card">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Total parcial</span>
          <span className="text-3xl font-extrabold tabular-nums tracking-tight text-foreground">
            {formatCurrency(totalAmount)}
          </span>
          <div className="mt-2.5 flex items-center gap-2 border-t border-border pt-2.5 text-xs text-muted-foreground">
            <span>
              {orders.length} {orders.length === 1 ? "pedido" : "pedidos"}
            </span>
            <span aria-hidden className="text-muted-foreground">
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
          <h2 className="text-sm font-semibold text-muted-foreground">Pedidos desta comanda</h2>
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
                    isUnprocessed ? "border-emerald-500/30 bg-emerald-500/[0.07] elevation-card" : "border-border bg-surface elevation-card",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-baseline gap-1.5 font-semibold text-foreground">
                      Pedido #{orderNumberById.get(order.id)}
                      <span className="text-xs font-normal tabular-nums text-muted-foreground">
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

                  <ul className="flex flex-col gap-1 border-t border-border/80 pt-2.5">
                    {order.items.map((item, index) => (
                      <li key={`${order.id}-${item.name}-${index}`} className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{item.quantity}×</span>{" "}
                        {item.halfAndHalf
                          ? `Meio a meio: ${item.halfAndHalf.flavor_a_name} / ${item.halfAndHalf.flavor_b_name}`
                          : item.name}
                        {item.selectedOptions && item.selectedOptions.length > 0 && (
                          <div className="mt-1 flex flex-col gap-1 pl-5">
                            {groupSelectedOptions(item.selectedOptions).map(([groupName, options]) => (
                              <div key={groupName}>
                                <span className="font-semibold text-foreground">{groupName}:</span>
                                <ul className="ml-2 flex flex-col">
                                  {options.map((option, optionIndex) => (
                                    <li key={`${groupName}-${option.option_name}-${optionIndex}`}>{option.option_name}</li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )}
                        {item.notes && <span className="italic"> — {item.notes}</span>}
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


function groupSelectedOptions(
  options: { group_name: string; option_name: string; price_delta: number }[],
): [string, { group_name: string; option_name: string; price_delta: number }[]][] {
  const groups = new Map<string, { group_name: string; option_name: string; price_delta: number }[]>();

  for (const option of options) {
    const group = groups.get(option.group_name);
    if (group) {
      group.push(option);
    } else {
      groups.set(option.group_name, [option]);
    }
  }

  return Array.from(groups.entries());
}
