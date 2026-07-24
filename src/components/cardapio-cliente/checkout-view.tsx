"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, ShoppingBag } from "lucide-react";
import { RestaurantHeader } from "@/components/cardapio-cliente/restaurant-header";
import { CartProvider, useCart } from "@/components/cardapio-cliente/cart-context";
import { CartLineItem } from "@/components/cardapio-cliente/cart-line-item";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
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
 * `POST /api/v1/public/{slug}/orders` (contrato 3.3, já implementado desde
 * a Fase 2 — nenhuma API nova aqui) e os três estados pedidos (carregando,
 * sucesso, erro). No sucesso: limpa o carrinho e redireciona ao
 * acompanhamento — mesma ordem descrita na Sprint (11 antes de 12).
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

  // Sprint 10 (auditoria): o `setTimeout` de `handleSubmit` (abaixo) não
  // tinha cleanup — se o componente desmontasse antes dos 1200ms (ex.:
  // cliente fecha a aba logo após o pedido ser aceito), o timer ainda
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

      // 11 (limpar carrinho) antes de 12 (redirecionar) — nessa ordem, para
      // que o carrinho já esteja vazio se o cliente voltar pelo histórico do
      // navegador.
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-8 w-8 text-success" aria-hidden />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-display text-lg font-semibold text-foreground">Pedido realizado!</p>
          <p className="text-sm text-muted-foreground">Levando você para o acompanhamento...</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col">
        <RestaurantHeader restaurantName={restaurantName} tableName={tableName} />
        <main className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            icon={ShoppingBag}
            title="Seu carrinho está vazio"
            description="Volte ao cardápio para adicionar produtos antes de finalizar."
            action={<ButtonLink href={menuHref}>Ver cardápio</ButtonLink>}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col pb-8">
      <RestaurantHeader restaurantName={restaurantName} tableName={tableName} />

      <div className="px-4 pt-4">
        <ButtonLink href={cartHref} variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar ao carrinho
        </ButtonLink>
      </div>

      <main className="flex flex-1 flex-col gap-5 px-4 py-4 pb-40">
        <h1 className="font-display text-xl font-semibold text-foreground">Confirmar pedido</h1>

        {!tableToken && (
          <Alert variant="warning">
            Não identificamos sua mesa. Escaneie novamente o QR Code para finalizar o pedido.
          </Alert>
        )}

        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <CartLineItem key={`${item.menuItemId}:${item.notes ?? ""}`} item={item} />
          ))}
        </div>

        <FormField label="Observações do pedido" hint="Opcional — algo geral para a cozinha ou o atendente.">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: trazer talheres extras, entregar tudo junto..."
            rows={3}
            disabled={status === "submitting"}
          />
        </FormField>

        {staleItems && staleItems.length > 0 && (
          <Alert variant="destructive" className="flex-col items-stretch gap-2">
            <p>Estes itens mudaram desde que você montou o carrinho: {staleItems.join(", ")}.</p>
            <ButtonLink href={cartHref} variant="outline" size="sm" className="self-start">
              Voltar ao carrinho
            </ButtonLink>
          </Alert>
        )}

        {errorMessage && !staleItems && <Alert variant="destructive">{errorMessage}</Alert>}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md flex-col gap-3 border-t border-border bg-surface p-4 shadow-bar">
        <div className="flex items-center justify-between">
          <span className="font-medium text-foreground">Total</span>
          <span className="font-mono text-lg font-semibold text-foreground">{formatCurrency(subtotal)}</span>
        </div>
        <Button
          size="lg"
          className="w-full"
          onClick={handleSubmit}
          isLoading={status === "submitting"}
          disabled={!tableToken || status === "submitting"}
        >
          Confirmar pedido
        </Button>
      </div>
    </div>
  );
}
