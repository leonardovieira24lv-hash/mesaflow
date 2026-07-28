"use client";

import { useState } from "react";
import { Bell, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="flex gap-2 border-b border-border bg-surface px-4 py-2.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="flex-1 justify-center"
        onClick={() => handleAction("waiter")}
        disabled={calledWaiter}
        isLoading={loadingAction === "waiter"}
      >
        <Bell className="h-3.5 w-3.5" />
        {calledWaiter ? "Garçom chamado" : "Chamar garçom"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="flex-1 justify-center"
        onClick={() => handleAction("bill")}
        disabled={requestedBill}
        isLoading={loadingAction === "bill"}
      >
        <Receipt className="h-3.5 w-3.5" />
        {requestedBill ? "Conta pedida" : "Pedir a conta"}
      </Button>
    </div>
  );
}
