"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

interface ManualTableItemFormProps {
  tableId: string;
  tableName?: string;
  onAdded: () => void;
}

function parseMoneyInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function ManualTableItemForm({ tableId, tableName, onAdded }: ManualTableItemFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [unitAmount, setUnitAmount] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const parsedUnitAmount = useMemo(() => parseMoneyInput(unitAmount), [unitAmount]);
  const total = parsedUnitAmount === null ? 0 : Math.round(parsedUnitAmount * quantity * 100) / 100;

  function reset() {
    setName("");
    setUnitAmount("");
    setQuantity(1);
    setNotes("");
    setError(null);
  }

  function close() {
    if (submitting) return;
    reset();
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Informe uma descrição.");
      return;
    }
    if (parsedUnitAmount === null) {
      setError("Informe um valor válido. Ex.: 8,00");
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      setError("Informe uma quantidade válida.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/v1/tables/${tableId}/manual-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          amount: parsedUnitAmount,
          quantity,
          notes: notes.trim() || undefined,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body?.error?.message ?? "Não foi possível adicionar o item avulso.");
        return;
      }

      toast.success(`${name.trim()} adicionado — ${formatCurrency(total)}`);
      reset();
      setOpen(false);
      onAdded();
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Adicionar item avulso
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-0 backdrop-blur-[1px] sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <form
            onSubmit={handleSubmit}
            role="dialog"
            aria-modal="true"
            aria-label="Novo item avulso"
            className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-ds2-xl border border-ds2-border bg-ds2-surface shadow-ds2-lg sm:max-w-md sm:rounded-ds2-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-ds2-border px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-ds2-foreground">Novo item avulso</h3>
                <p className="mt-0.5 text-xs text-ds2-foreground-muted">
                  {tableName ? `${tableName} · ` : ""}Lançamento interno — não aparece no cardápio.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={submitting}
                aria-label="Fechar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ds2-foreground-muted hover:bg-ds2-surface-hover"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-ds2-foreground">
                Descrição
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={120}
                  placeholder="Ex.: Cover artístico"
                  disabled={submitting}
                  autoFocus
                  className="h-11 rounded-ds2-md border border-ds2-border bg-ds2-background px-3 text-base text-ds2-foreground outline-none focus:border-ds2-primary focus:ring-2 focus:ring-ds2-primary/20"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-ds2-foreground">
                Valor unitário
                <div className="flex h-11 items-center rounded-ds2-md border border-ds2-border bg-ds2-background px-3 focus-within:border-ds2-primary focus-within:ring-2 focus-within:ring-ds2-primary/20">
                  <span className="mr-2 text-sm font-semibold text-ds2-foreground-muted">R$</span>
                  <input
                    value={unitAmount}
                    onChange={(event) => setUnitAmount(event.target.value)}
                    inputMode="decimal"
                    placeholder="0,00"
                    disabled={submitting}
                    className="min-w-0 flex-1 bg-transparent text-base text-ds2-foreground outline-none"
                  />
                </div>
              </label>

              <div>
                <p className="mb-1.5 text-sm font-medium text-ds2-foreground">Quantidade</p>
                <div className="grid grid-cols-[48px_1fr_48px] items-center overflow-hidden rounded-ds2-md border border-ds2-border bg-ds2-background">
                  <button
                    type="button"
                    aria-label="Diminuir quantidade"
                    disabled={submitting || quantity <= 1}
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    className="flex h-12 items-center justify-center border-r border-ds2-border disabled:opacity-40"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <input
                    value={quantity}
                    onChange={(event) => {
                      const value = event.target.value.replace(/\D/g, "");
                      setQuantity(Math.min(999, Math.max(1, Number(value) || 1)));
                    }}
                    inputMode="numeric"
                    aria-label="Quantidade"
                    className="h-12 min-w-0 bg-transparent text-center text-xl font-bold tabular-nums text-ds2-foreground outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Aumentar quantidade"
                    disabled={submitting || quantity >= 999}
                    onClick={() => setQuantity((value) => Math.min(999, value + 1))}
                    className="flex h-12 items-center justify-center border-l border-ds2-border disabled:opacity-40"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="rounded-ds2-lg border border-ds2-primary/30 bg-ds2-primary/5 px-4 py-3 text-center">
                <p className="text-xs text-ds2-foreground-muted">Total deste item</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-ds2-foreground">
                  {formatCurrency(total)}
                </p>
                {parsedUnitAmount !== null && quantity > 1 && (
                  <p className="mt-1 text-xs text-ds2-foreground-muted">
                    {quantity} × {formatCurrency(parsedUnitAmount)}
                  </p>
                )}
              </div>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-ds2-foreground">
                Observação <span className="font-normal text-ds2-foreground-muted">(opcional)</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={300}
                  rows={2}
                  placeholder="Ex.: cobrança para 10 pessoas"
                  disabled={submitting}
                  className="resize-none rounded-ds2-md border border-ds2-border bg-ds2-background px-3 py-2 text-sm text-ds2-foreground outline-none focus:border-ds2-primary focus:ring-2 focus:ring-ds2-primary/20"
                />
              </label>

              {error && <p className="text-xs font-medium text-ds2-danger">{error}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-ds2-border bg-ds2-surface px-5 py-4">
              <Button type="button" variant="ghost" onClick={close} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="submit" isLoading={submitting}>
                Adicionar à mesa
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
