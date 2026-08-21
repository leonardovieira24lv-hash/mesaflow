"use client";

import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

interface ManualTableItemFormProps {
  tableId: string;
  onAdded: () => void;
}

function parseMoneyInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

export function ManualTableItemForm({ tableId, onAdded }: ManualTableItemFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setAmount("");
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

    const parsedAmount = parseMoneyInput(amount);
    if (!name.trim()) {
      setError("Informe uma descrição.");
      return;
    }
    if (parsedAmount === null) {
      setError("Informe um valor válido. Ex.: 27,80");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/v1/tables/${tableId}/manual-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          amount: parsedAmount,
          notes: notes.trim() || undefined,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body?.error?.message ?? "Não foi possível adicionar o item avulso.");
        return;
      }

      toast.success("Item avulso adicionado");
      reset();
      setOpen(false);
      onAdded();
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Adicionar item avulso
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-ds2-lg border border-ds2-border bg-ds2-surface p-3.5 shadow-ds2-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ds2-foreground">Item avulso</p>
          <p className="text-xs text-ds2-foreground-muted">Lançamento interno — não aparece no cardápio.</p>
        </div>
        <button
          type="button"
          onClick={close}
          disabled={submitting}
          aria-label="Fechar lançamento avulso"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ds2-foreground-muted hover:bg-ds2-surface-hover"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-ds2-foreground">
        Descrição
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          placeholder="Ex.: Prato self-service"
          disabled={submitting}
          autoFocus
          className="h-10 rounded-ds2-md border border-ds2-border bg-ds2-background px-3 text-sm text-ds2-foreground outline-none focus:border-ds2-primary focus:ring-2 focus:ring-ds2-primary/20"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-ds2-foreground">
        Valor final
        <div className="flex h-10 items-center rounded-ds2-md border border-ds2-border bg-ds2-background px-3 focus-within:border-ds2-primary focus-within:ring-2 focus-within:ring-ds2-primary/20">
          <span className="mr-2 text-sm font-semibold text-ds2-foreground-muted">R$</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            disabled={submitting}
            className="min-w-0 flex-1 bg-transparent text-sm text-ds2-foreground outline-none"
          />
        </div>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-ds2-foreground">
        Observação <span className="font-normal text-ds2-foreground-muted">(opcional)</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Ex.: prato 438 g"
          disabled={submitting}
          className="resize-none rounded-ds2-md border border-ds2-border bg-ds2-background px-3 py-2 text-sm text-ds2-foreground outline-none focus:border-ds2-primary focus:ring-2 focus:ring-ds2-primary/20"
        />
      </label>

      {error && <p className="text-xs font-medium text-ds2-danger">{error}</p>}

      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="flex-1" onClick={close} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" isLoading={submitting}>
          Adicionar à mesa
        </Button>
      </div>
    </form>
  );
}
