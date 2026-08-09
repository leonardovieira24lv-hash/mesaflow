"use client";

import { useState } from "react";
import { Bell, Check, Loader2, Receipt } from "lucide-react";
import { toast } from "@/components/ui/toast";

interface TableAssistanceActionsProps {
  slug: string;
  tableToken: string | null;
}

/**
 * "Chamar garçom" / "Solicitar conta" (docs/table-events-roadmap.md) — Área
 * do Cliente. Renderizado nas telas onde o cliente já está sentado numa
 * mesa de verdade (Cardápio, Carrinho, Checkout — todas já recebem
 * `tableToken` via `CartProvider`/props). Sem mesa (`tableToken` null —
 * cardápio acessado sem passar pela mesa resolvedora, ex.: link direto sem
 * QR Code) não há para qual mesa mandar o alerta, então não renderiza nada.
 *
 * Estado local simples (`calledWaiter`/`requestedBill`) só para feedback
 * imediato nesta sessão de navegação — não persiste entre páginas nem
 * sobrevive a um F5 de propósito: os endpoints já são idempotentes (um
 * segundo toque, mesmo depois de recarregar, reaproveita o alerta em
 * aberto em vez de duplicar — `lib/table-events/create-table-event.ts`),
 * então o pior caso de "esqueceu que já chamou" é inofensivo, não gera
 * alerta duplicado no painel do restaurante.
 *
 * Sprint "Cardápio Dark/Premium" (2026-08-09): primeira tentativa usou
 * `bg-zinc-900` sobre o fundo `zinc-950` da página — diferença de tom
 * quase imperceptível, então os botões viraram "contorno com texto
 * dentro", sem presença nenhuma (confirmado por captura de tela real).
 *
 * Correção: cada ação agora é um botão com superfície própria de verdade
 * (`zinc-800`, dois passos acima do fundo), ícone dentro de um badge
 * arredondado `zinc-700` que lhe dá peso visual, e altura de 44px. São
 * ações SECUNDÁRIAS de propósito (o verde fica reservado para
 * "Adicionar ao carrinho"/"Finalizar pedido", conforme a hierarquia do
 * produto), mas secundário aqui significa "cinza sólido com presença", não
 * "texto com borda". O estado confirmado troca o ícone por um check e passa
 * a verde translúcido, para o cliente ver que o pedido foi registrado.
 *
 * Nenhuma chamada de API, endpoint, estado ou lógica de idempotência foi
 * tocada.
 */
export function TableAssistanceActions({ slug, tableToken }: TableAssistanceActionsProps) {
  const [calledWaiter, setCalledWaiter] = useState(false);
  const [requestedBill, setRequestedBill] = useState(false);
  const [loadingAction, setLoadingAction] = useState<"waiter" | "bill" | null>(null);

  if (!tableToken) return null;

  async function handleAction(action: "waiter" | "bill") {
    if (loadingAction) return;
    setLoadingAction(action);
    try {
      const endpoint = action === "waiter" ? "call-waiter" : "request-bill";
      const response = await fetch(`/api/v1/public/${slug}/tables/${tableToken}/${endpoint}`, { method: "POST" });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(body?.error?.message ?? "Não foi possível enviar. Tente novamente.");
        return;
      }

      if (action === "waiter") {
        setCalledWaiter(true);
        toast.success("Garçom chamado", "Alguém vai até sua mesa em instantes.");
      } else {
        setRequestedBill(true);
        toast.success("Conta solicitada", "Já vamos preparar sua conta.");
      }
    } catch {
      toast.error("Não foi possível conectar. Verifique sua internet.");
    } finally {
      setLoadingAction(null);
    }
  }

  const baseButton =
    "group flex flex-1 min-h-[44px] items-center justify-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-semibold transition active:scale-[0.97] disabled:pointer-events-none";
  const idleButton = `${baseButton} bg-zinc-800 text-white shadow-sm shadow-black/40 hover:bg-zinc-700`;
  const doneButton = `${baseButton} bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30`;
  const iconBadge =
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-zinc-100 transition group-hover:bg-zinc-600";
  const iconBadgeDone = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/25 text-emerald-300";

  return (
    <div className="flex gap-2.5 border-b border-zinc-800 bg-zinc-950 px-4 py-3">
      <button
        type="button"
        onClick={() => handleAction("waiter")}
        disabled={calledWaiter || loadingAction === "waiter"}
        className={calledWaiter ? doneButton : idleButton}
      >
        <span aria-hidden className={calledWaiter ? iconBadgeDone : iconBadge}>
          {loadingAction === "waiter" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : calledWaiter ? (
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          ) : (
            <Bell className="h-3.5 w-3.5" strokeWidth={2.5} />
          )}
        </span>
        {calledWaiter ? "Garçom chamado" : "Chamar garçom"}
      </button>

      <button
        type="button"
        onClick={() => handleAction("bill")}
        disabled={requestedBill || loadingAction === "bill"}
        className={requestedBill ? doneButton : idleButton}
      >
        <span aria-hidden className={requestedBill ? iconBadgeDone : iconBadge}>
          {loadingAction === "bill" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : requestedBill ? (
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          ) : (
            <Receipt className="h-3.5 w-3.5" strokeWidth={2.5} />
          )}
        </span>
        {requestedBill ? "Conta pedida" : "Pedir a conta"}
      </button>
    </div>
  );
}
