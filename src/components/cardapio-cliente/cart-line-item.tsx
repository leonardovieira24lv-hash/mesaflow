import Image from "next/image";
import { Minus, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { CartItem } from "@/components/cardapio-cliente/cart-context";

interface CartLineItemProps {
  item: CartItem;
  /** Mostra os controles de quantidade/remoção (tela de Carrinho). Sem isto, é só leitura (tela de Checkout). */
  editable?: boolean;
  onUpdateQuantity?: (quantity: number) => void;
  onRemove?: () => void;
}

/**
 * Uma linha do carrinho (Fase 5, itens 2-4: listagem, alteração de
 * quantidade, remoção). O mesmo componente serve à tela de Checkout em modo
 * somente leitura (`editable=false`), evitando duas versões quase iguais da
 * mesma lista de itens.
 *
 * Marco 2: ganhou miniatura (quando o item tem `imageUrl`) — o cliente
 * revisa o pedido reconhecendo visualmente o prato, não só pelo nome — e
 * alvos de toque de 40px nos controles de quantidade (eram 32px).
 *
 * Sprint "Cardápio Dark/Premium" (2026-08-09): este era o último card
 * branco do fluxo público — aparecia isolado no meio do Carrinho/Checkout
 * já escuros (confirmado por captura de tela real), porque dependia de
 * tokens do design system antigo (`bg-surface`, `border-border`,
 * `shadow-card`, `bg-muted`, `text-foreground`, `text-primary`) que não
 * resolvem mais, e do componente `<Button>` (que renderiza sem estilo
 * visível em produção).
 *
 * Reconstrução visual, alinhada ao `<MenuItemCard>` do cardápio para as
 * duas telas parecerem o mesmo produto:
 * - superfície `zinc-900` sobre o fundo `zinc-950` da página (elevação por
 *   diferença de tom, não por sombra forte);
 * - miniatura maior (64px) com cantos arredondados e fundo próprio, para a
 *   foto do prato ter presença mesmo em lista;
 * - hierarquia tipográfica: nome branco semibold, observação em
 *   `zinc-500` menor, preço da linha em `emerald-400` — mesma cor de preço
 *   do cardápio, criando continuidade entre as telas;
 * - controles de quantidade agrupados num pill `zinc-800` (mais claro que o
 *   card = parece um controle real, tocável), com o número em destaque
 *   entre `-` e `+`;
 * - excluir separado do pill de quantidade por um divisor, em `zinc-500`
 *   que vira vermelho no hover — visualmente secundário e destrutivo, não
 *   competindo com os controles de quantidade;
 * - alvos de toque de 40px mantidos (`h-10 w-10`), como no Marco 2.
 *
 * Nenhuma prop, handler, cálculo (`lineTotal`) ou comportamento foi
 * alterado — `onUpdateQuantity`/`onRemove`/`editable` seguem idênticos.
 *
 * Etapa 3K — Migração para Tokens (2026-08-12): card migrou pra
 * `bg-surface`/`border-border` + `elevation-card` (mesmo card "3D" do
 * cardápio, mesma classe, mesma calibração). Pill de quantidade virou
 * `bg-background` (branca, dentro do card cinza — mesma hierarquia
 * página/card/pill já usada em `product-detail-modal.tsx`). Preço
 * (`emerald-400`→`emerald-600`) e hover de excluir
 * (`text-red-400`→`text-red-600`) recalibrados por contraste — mesmo tom,
 * mais escuro pra continuar legível em fundo claro (mesmo raciocínio já
 * aplicado ao preço do cardápio).
 */
export function CartLineItem({ item, editable = false, onUpdateQuantity, onRemove }: CartLineItemProps) {
  const lineTotal = item.price * item.quantity;

  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-surface p-3 elevation-card">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt="" fill sizes="64px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <UtensilsCrossed className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate font-semibold text-foreground">{item.name}</p>
        {item.notes && <p className="truncate text-xs text-muted-foreground">Obs.: {item.notes}</p>}
        <span className="text-sm font-bold tabular-nums text-soft-success-foreground">{formatCurrency(lineTotal)}</span>
      </div>

      {editable ? (
        <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-background p-1">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-90"
            onClick={() => onUpdateQuantity?.(item.quantity - 1)}
            aria-label={`Diminuir quantidade de ${item.name}`}
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
          <span className="w-5 text-center text-sm font-bold tabular-nums text-foreground">{item.quantity}</span>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-90"
            onClick={() => onUpdateQuantity?.(item.quantity + 1)}
            aria-label={`Aumentar quantidade de ${item.name}`}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>

          <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-red-500/15 hover:text-soft-danger-foreground active:scale-90"
            onClick={onRemove}
            aria-label={`Remover ${item.name} do carrinho`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <span className="shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold tabular-nums text-muted-foreground">
          Qtd. {item.quantity}
        </span>
      )}
    </div>
  );
}
