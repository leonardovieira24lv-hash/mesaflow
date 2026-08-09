"use client";

import { useState } from "react";
import { Bell, Loader2, Receipt } from "lucide-react";
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
 * Sprint "Cardápio Dark/Premium" (2026-08-09): `<Button variant="outline">`
 * estava renderizando como texto com borda fraca, sem nenhuma aparência
 * de botão real (confirmado por captura de tela real) — trocado por
 * `<button>` nativo com fundo/borda/hover/active próprios. Estado
 * "confirmado" (depois do clique) ganhou tratamento visual distinto
 * (verde translúcido) para ficar claro que a ação foi registrada. Nenhuma
 * chamada de API, endpoint ou lógica de idempotência foi tocada.
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

  return (
    <div className="flex gap-2 border-b border-zinc-800 bg-zinc-900/60 px-4 py-2.5">
      <button
        type="button"
        onClick={() => handleAction("waiter")}
        disabled={calledWaiter || loadingAction === "waiter"}
        className={
          calledWaiter
            ? "flex flex-1 min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-700/40 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-400"
            : "flex flex-1 min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-200 shadow-sm transition hover:border-zinc-600 hover:bg-zinc-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
        }
      >
        {loadingAction === "waiter" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Bell className="h-3.5 w-3.5" />
        )}
        {calledWaiter ? "Garçom chamado" : "Chamar garçom"}
      </button>
      <button
        type="button"
        onClick={() => handleAction("bill")}
        disabled={requestedBill || loadingAction === "bill"}
        className={
          requestedBill
            ? "flex flex-1 min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-700/40 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-400"
            : "flex flex-1 min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-200 shadow-sm transition hover:border-zinc-600 hover:bg-zinc-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
        }
      >
        {loadingAction === "bill" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Receipt className="h-3.5 w-3.5" />
        )}
        {requestedBill ? "Conta pedida" : "Pedir a conta"}
      </button>
    </div>
  );
}
