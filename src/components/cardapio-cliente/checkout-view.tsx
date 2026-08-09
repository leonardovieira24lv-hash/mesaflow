"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, ShoppingBag } from "lucide-react";
import { RestaurantHeader } from "@/components/cardapio-cliente/restaurant-header";
import { CartProvider, useCart } from "@/components/cardapio-cliente/cart-context";
import { CartLineItem } from "@/components/cardapio-cliente/cart-line-item";
import { OrderSummaryBar } from "@/components/cardapio-cliente/order-summary-bar";
import { TableAssistanceActions } from "@/components/cardapio-cliente/table-assistance-actions";
import { ROUTES } from "@/constants/routes";
import { withMesaQuery } from "@/lib/cliente-url";
import type { ApiError } from "@/types/api";

interface CheckoutViewProps {
  slug: string;
  tableToken: string | null;
  restaurantName: string;
  tableName?: string;
}

type SubmitStatus = "idle" | "submitting" | "success" | "error";

/**
 * Tela de checkout (Fase 5, itens 8-12): revisão somente-leitura do
 * carrinho, observação geral do pedido, envio para
 * `POST /api/v1/public/{slug}/orders` (contrato 3.3) e os três estados
 * pedidos (carregando, sucesso, erro). No sucesso: limpa o carrinho e
 * redireciona ao acompanhamento.
 *
 * Sprint de manutenção (2026-08-08): `OrderSummaryBar` deixou de ser
 * `position: fixed` nesta tela (teclado virtual em Android).
 *
 * Sprint de autossuficiência visual (2026-08-08, seguinte): "Voltar ao
 * carrinho", os avisos (mesa não identificada / preço desatualizado /
 * erro de rede), o campo de Observações e o estado de carrinho vazio
 * deixaram de depender de `ButtonLink`/`Alert`/`FormField`/`Textarea`/
 * `EmptyState` (estavam renderizando sem nenhum estilo visível em
 * produção, confirmado por captura de tela real) — agora são HTML nativo
 * com classes Tailwind diretas. Nenhuma lógica de submissão, idempotência
 * ou navegação foi tocada.
 *
 * Sprint "Cardápio Dark/Premium" (2026-08-09): fundo `zinc-950` em todas
 * as três variantes desta tela (sucesso, vazio, principal); avisos de
 * âmbar/vermelho ajustados para tons escuros translúcidos
 * (`amber-950/40`, `red-950/40`) mantendo o texto legível.
 *
 * RISCO AINDA NÃO RESOLVIDO: `<CartLineItem>` e `<TableAssistanceActions>`
 * são importados aqui mas eu nunca recebi o código-fonte deles — não
 * posso garantir que já estão no dark theme.
 */
export function CheckoutView(props: CheckoutViewProps) {
  return (
    <CartProvider slug={props.slug} tableToken={props.tableToken}>
      <CheckoutContent {...props} />
    </CartProvider>
  );
}

function CheckoutContent({ slug, tableToken, restaurantName, tableName }: CheckoutViewProps) {
  const router = useRouter();
  const { items, subtotal, clear } = useCart();
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [staleItems, setStaleItems] = useState<string[] | null>(null);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sprint 1 de Correção (Fase de Estabilização): uma única chave por
  // tentativa de checkout — gerada uma vez quando esta tela monta, reusada
  // em qualquer retry dentro da mesma visita a ela. O servidor usa isto
  // para reconhecer um reenvio e devolver o pedido já criado em vez de
  // duplicá-lo (`lib/orders/create-order.ts`).
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  // Sprint 10 (auditoria): cleanup do `setTimeout` de `handleSubmit` —
  // sem isso, se o componente desmontasse antes dos 1200ms, o timer ainda
  // disparava `clear()`/`router.push()` num componente já desmontado.
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
    };
  }, []);

  const menuHref = withMesaQuery(ROUTES.clienteMenu(slug), tableToken);
  const cartHref = withMesaQuery(ROUTES.clienteCarrinho(slug), tableToken);

  async function handleSubmit() {
    if (!tableToken || items.length === 0) return;

    setStatus("submitting");
    setErrorMessage(null);
    setStaleItems(null);

    try {
      const response = await fetch(`/api/v1/public/${slug}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table_token: tableToken,
          notes: notes.trim() || undefined,
          idempotency_key: idempotencyKeyRef.current,
          items: items.map((item) => ({
            menu_item_id: item.menuItemId,
            quantity: item.quantity,
            notes: item.notes,
          })),
        }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok || !body) {
        const apiError = body as ApiError | null;

        if (apiError?.error?.code === "STALE_PRICE_OR_AVAILABILITY" && apiError.error.details) {
          const affectedIds = new Set(apiError.error.details.map((detail) => detail.field));
          setStaleItems(items.filter((item) => affectedIds.has(item.menuItemId)).map((item) => item.name));
        } else if (apiError?.error?.code === "RATE_LIMITED") {
          setErrorMessage("Muitos pedidos enviados em pouco tempo. Aguarde um instante e tente novamente.");
        } else {
          setErrorMessage(apiError?.error?.message ?? "Não foi possível criar o pedido. Tente novamente.");
        }

        setStatus("error");
        return;
      }

      const createdOrder = (body.data as { order: { id: string } }).order;
      setStatus("success");

      redirectTimeoutRef.current = setTimeout(() => {
        clear();
        router.push(ROUTES.clienteAcompanharPedido(slug, createdOrder.id));
      }, 1200);
    } catch {
      setErrorMessage("Não foi possível conectar. Verifique sua internet e tente novamente.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-zinc-950 p-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15">
          <CheckCircle2 className="h-10 w-10 text-emerald-400" aria-hidden />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-xl font-bold text-white">Pedido realizado!</p>
          <p className="text-sm text-zinc-500">Levando você para o acompanhamento...</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col bg-zinc-950 sm:border-x sm:border-zinc-800 sm:shadow-sm">
        <RestaurantHeader restaurantName={restaurantName} tableName={tableName} />
        <TableAssistanceActions slug={slug} tableToken={tableToken} />
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900 px-6 py-12 text-center">
            <ShoppingBag className="h-10 w-10 text-zinc-300" aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-white">Seu carrinho está vazio</p>
              <p className="text-sm text-zinc-500">Volte ao cardápio para adicionar produtos antes de finalizar.</p>
            </div>
            <Link
              href={menuHref}
              className="mt-1 flex min-h-11 items-center justify-center rounded-xl bg-emerald-500 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-emerald-600 active:scale-[0.98]"
            >
              Ver cardápio
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col bg-zinc-950 pb-8 sm:border-x sm:border-zinc-800 sm:shadow-sm">
      <RestaurantHeader restaurantName={restaurantName} tableName={tableName} />
      <TableAssistanceActions slug={slug} tableToken={tableToken} />

      <div className="px-4 pt-4">
        <Link
          href={cartHref}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 active:scale-[0.98]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar ao carrinho
        </Link>
      </div>

      <main className="flex flex-1 flex-col gap-5 px-4 py-4">
        <h1 className="text-xl font-bold tracking-tight text-white">Confirmar pedido</h1>

        {!tableToken && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-800/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>Não identificamos sua mesa. Escaneie novamente o QR Code para finalizar o pedido.</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <CartLineItem key={`${item.menuItemId}:${item.notes ?? ""}`} item={item} />
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="checkout-notes" className="text-sm font-medium text-white">
            Observações do pedido
          </label>
          <textarea
            id="checkout-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: trazer talheres extras, entregar tudo junto..."
            rows={3}
            disabled={status === "submitting"}
            className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
          />
          <p className="text-xs text-zinc-500">Opcional — algo geral para a cozinha ou o atendente.</p>
        </div>

        {staleItems && staleItems.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-red-800/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            <p>Estes itens mudaram desde que você montou o carrinho: {staleItems.join(", ")}.</p>
            <Link
              href={cartHref}
              className="self-start rounded-lg border border-red-700/60 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/15"
            >
              Voltar ao carrinho
            </Link>
          </div>
        )}

        {errorMessage && !staleItems && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-800/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>{errorMessage}</p>
          </div>
        )}
      </main>

      <OrderSummaryBar
        total={subtotal}
        actionLabel="Confirmar pedido"
        onAction={handleSubmit}
        isLoading={status === "submitting"}
        disabled={!tableToken || status === "submitting"}
        mode="static"
      />
    </div>
  );
}
