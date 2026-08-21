"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ChevronDown, Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

const QUICK_ITEMS = [
  "Self-service",
  "Couvert artístico",
  "Taxa de rolha",
  "Ingresso",
  "Prato extra",
] as const;

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
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [manualDescription, setManualDescription] = useState(false);
  const [name, setName] = useState("");
  const [unitAmount, setUnitAmount] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const parsedUnitAmount = useMemo(() => parseMoneyInput(unitAmount), [unitAmount]);
  const total = parsedUnitAmount === null ? 0 : Math.round(parsedUnitAmount * quantity * 100) / 100;

  function reset() {
    setQuickMenuOpen(false);
    setManualDescription(false);
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

  function selectQuickItem(item: string) {
    setName(item);
    setManualDescription(false);
    setQuickMenuOpen(false);
    setError(null);
  }

  function selectManualItem() {
    setName("");
    setManualDescription(true);
    setQuickMenuOpen(false);
    setError(null);
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

      const rawBody = await response.text();
      let body: { error?: { message?: string } } | null = null;
      if (rawBody) {
        try {
          body = JSON.parse(rawBody) as { error?: { message?: string } };
        } catch {
          body = null;
        }
      }

      if (!response.ok) {
        const message = body?.error?.message ?? "Não foi possível adicionar o item avulso.";
        setError(message);
        toast.error("Item não adicionado", message);
        return;
      }

      toast.success("Item adicionado à mesa", `${name.trim()} · ${formatCurrency(total)}`);
      reset();
      setOpen(false);
      onAdded();
    } catch {
      const message = "Não foi possível conectar. Verifique sua internet e tente novamente.";
      setError(message);
      toast.error("Falha ao adicionar item", message);
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
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-3 backdrop-blur-[1px]"
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
            className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-sm flex-col overflow-hidden rounded-ds2-xl border border-ds2-border bg-ds2-surface shadow-ds2-lg"
          >
            <div className="flex items-start justify-between gap-3 border-b border-ds2-border px-4 py-3">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-ds2-foreground">Novo item avulso</h3>
                <p className="mt-0.5 text-[11px] text-ds2-foreground-muted">
                  {tableName ? `${tableName} · ` : ""}cobrança manual da mesa
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={submitting}
                aria-label="Fechar"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ds2-foreground-muted hover:bg-ds2-surface-hover"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
              <div className="rounded-ds2-md border border-ds2-border bg-ds2-background/60 px-3 py-2">
                <p className="text-[11px] leading-4 text-ds2-foreground-muted">
                  Use para qualquer cobrança que não esteja no cardápio: cover, taxa de rolha,
                  ingresso, prato extra, serviço especial ou outro lançamento manual.
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ds2-foreground">Descrição</span>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setQuickMenuOpen((value) => !value)}
                    disabled={submitting}
                    className="flex h-10 w-full items-center justify-between rounded-ds2-md border border-ds2-border bg-ds2-background px-3 text-left text-sm text-ds2-foreground outline-none transition-colors hover:bg-ds2-surface-hover focus:border-ds2-primary focus:ring-2 focus:ring-ds2-primary/20"
                    aria-expanded={quickMenuOpen}
                    aria-haspopup="listbox"
                  >
                    <span className={name ? "truncate" : "truncate text-ds2-foreground-muted"}>
                      {name || "Selecionar item rápido"}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-ds2-foreground-muted transition-transform ${
                        quickMenuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {quickMenuOpen && (
                    <div
                      role="listbox"
                      className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 overflow-hidden rounded-ds2-md border border-ds2-border bg-ds2-surface shadow-ds2-md"
                    >
                      {QUICK_ITEMS.map((item) => (
                        <button
                          key={item}
                          type="button"
                          role="option"
                          aria-selected={name === item && !manualDescription}
                          onClick={() => selectQuickItem(item)}
                          className="flex h-9 w-full items-center px-3 text-left text-sm text-ds2-foreground hover:bg-ds2-surface-hover"
                        >
                          {item}
                        </button>
                      ))}
                      <button
                        type="button"
                        role="option"
                        aria-selected={manualDescription}
                        onClick={selectManualItem}
                        className="flex h-9 w-full items-center border-t border-ds2-border px-3 text-left text-sm font-medium text-ds2-primary hover:bg-ds2-surface-hover"
                      >
                        + Outro item...
                      </button>
                    </div>
                  )}
                </div>

                {manualDescription && (
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={120}
                    placeholder="Digite a descrição"
                    disabled={submitting}
                    autoFocus
                    className="h-10 rounded-ds2-md border border-ds2-border bg-ds2-background px-3 text-sm text-ds2-foreground outline-none focus:border-ds2-primary focus:ring-2 focus:ring-ds2-primary/20"
                  />
                )}
              </div>

              <div className="grid grid-cols-[1fr_132px] gap-2.5">
                <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-ds2-foreground">
                  Valor unitário
                  <div className="flex h-10 items-center rounded-ds2-md border border-ds2-border bg-ds2-background px-2.5 focus-within:border-ds2-primary focus-within:ring-2 focus-within:ring-ds2-primary/20">
                    <span className="mr-1.5 text-xs font-semibold text-ds2-foreground-muted">R$</span>
                    <input
                      value={unitAmount}
                      onChange={(event) => setUnitAmount(event.target.value)}
                      inputMode="decimal"
                      placeholder="0,00"
                      disabled={submitting}
                      className="min-w-0 flex-1 bg-transparent text-sm text-ds2-foreground outline-none"
                    />
                  </div>
                </label>

                <div>
                  <p className="mb-1 text-xs font-medium text-ds2-foreground">Quantidade</p>
                  <div className="grid h-10 grid-cols-[34px_1fr_34px] items-center overflow-hidden rounded-ds2-md border border-ds2-border bg-ds2-background">
                    <button
                      type="button"
                      aria-label="Diminuir quantidade"
                      disabled={submitting || quantity <= 1}
                      onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                      className="flex h-full items-center justify-center border-r border-ds2-border disabled:opacity-40"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      value={quantity}
                      onChange={(event) => {
                        const value = event.target.value.replace(/\D/g, "");
                        setQuantity(Math.min(999, Math.max(1, Number(value) || 1)));
                      }}
                      inputMode="numeric"
                      aria-label="Quantidade"
                      className="h-full min-w-0 bg-transparent text-center text-base font-bold tabular-nums text-ds2-foreground outline-none"
                    />
                    <button
                      type="button"
                      aria-label="Aumentar quantidade"
                      disabled={submitting || quantity >= 999}
                      onClick={() => setQuantity((value) => Math.min(999, value + 1))}
                      className="flex h-full items-center justify-center border-l border-ds2-border disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-ds2-md border border-ds2-primary/25 bg-ds2-primary/5 px-3 py-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-ds2-foreground-muted">Total</p>
                  {parsedUnitAmount !== null && quantity > 1 && (
                    <p className="text-[10px] text-ds2-foreground-muted">
                      {quantity} × {formatCurrency(parsedUnitAmount)}
                    </p>
                  )}
                </div>
                <p className="text-lg font-bold tabular-nums text-ds2-foreground">{formatCurrency(total)}</p>
              </div>

              <label className="flex flex-col gap-1 text-xs font-medium text-ds2-foreground">
                Observação <span className="font-normal text-ds2-foreground-muted">(opcional)</span>
                <input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={300}
                  placeholder="Ex.: detalhe importante do lançamento"
                  disabled={submitting}
                  className="h-10 rounded-ds2-md border border-ds2-border bg-ds2-background px-3 text-sm text-ds2-foreground outline-none focus:border-ds2-primary focus:ring-2 focus:ring-ds2-primary/20"
                />
              </label>

              {error && (
                <p role="alert" className="rounded-ds2-sm bg-ds2-danger/10 px-3 py-2 text-xs font-medium text-ds2-danger">
                  {error}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-ds2-border bg-ds2-surface px-4 py-3">
              <Button type="button" variant="ghost" size="sm" onClick={close} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" isLoading={submitting}>
                Adicionar à mesa
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
