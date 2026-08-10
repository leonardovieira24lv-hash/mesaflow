"use client";

import { useState, type FormEvent } from "react";
import { Clock, CreditCard, Plus, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { PAYMENT_METHOD_VALUES } from "@/lib/validations/tables";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/cashier/queries";
import type { OpeningHours } from "@/lib/validations/restaurant";
import type { ApiError } from "@/types/api";

type DayKey = keyof OpeningHours;

const DAY_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS: Record<DayKey, string> = {
  mon: "Segunda-feira",
  tue: "Terça-feira",
  wed: "Quarta-feira",
  thu: "Quinta-feira",
  fri: "Sexta-feira",
  sat: "Sábado",
  sun: "Domingo",
};

const EMPTY_OPENING_HOURS: OpeningHours = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };

interface OperacaoManagerProps {
  initialOpeningHours: OpeningHours | null;
  initialAcceptedPaymentMethods: PaymentMethod[];
}

/**
 * Área de Operação — Fase 4A (2026-08-10). `Configurações → Operação`,
 * página própria (`configuracoes/operacao/page.tsx`), mesmo precedente já
 * estabelecido por `equipe/page.tsx` — não emendado dentro de
 * `RestaurantSettingsForm`.
 *
 * Mesmo padrão de formulário das outras telas de Configurações: estado
 * local, `fetch` direto pro `PATCH /api/v1/restaurant` já existente (não é
 * endpoint novo), diff parcial (só envia o que mudou), `toast` para
 * sucesso/erro.
 *
 * Nesta Sprint (4A), a configuração só é persistida — nada aqui afeta
 * Cardápio Público, Mesas ou Caixa ainda (Fase 4B, separada e futura).
 */
export function OperacaoManager({ initialOpeningHours, initialAcceptedPaymentMethods }: OperacaoManagerProps) {
  const [openingHours, setOpeningHours] = useState<OpeningHours>(initialOpeningHours ?? EMPTY_OPENING_HOURS);
  const [acceptedMethods, setAcceptedMethods] = useState<PaymentMethod[]>(initialAcceptedPaymentMethods);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function addPeriod(day: DayKey) {
    setOpeningHours((prev) => ({ ...prev, [day]: [...prev[day], { open: "09:00", close: "18:00" }] }));
  }

  function removePeriod(day: DayKey, index: number) {
    setOpeningHours((prev) => ({ ...prev, [day]: prev[day].filter((_, i) => i !== index) }));
  }

  function updatePeriod(day: DayKey, index: number, field: "open" | "close", value: string) {
    setOpeningHours((prev) => ({
      ...prev,
      [day]: prev[day].map((period, i) => (i === index ? { ...period, [field]: value } : period)),
    }));
  }

  function toggleMethod(method: PaymentMethod) {
    setAcceptedMethods((prev) => (prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);

    if (acceptedMethods.length === 0) {
      setErrorMessage("Selecione pelo menos uma forma de pagamento.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/v1/restaurant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opening_hours: openingHours, accepted_payment_methods: acceptedMethods }),
      });
      const body = await response.json();

      if (!response.ok) {
        const apiError = body as ApiError;
        const firstDetail = apiError.error?.details?.[0]?.issue;
        setErrorMessage(firstDetail ?? apiError.error?.message ?? "Não foi possível salvar.");
        return;
      }

      toast.success("Operação atualizada", "Horário e formas de pagamento salvos.");
    } catch {
      toast.error("Não foi possível conectar", "Verifique sua internet e tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" aria-hidden />
            Horário de funcionamento
          </CardTitle>
          <CardDescription>
            Adicione um ou mais períodos por dia. Um dia sem período fica marcado como fechado.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col">
          {DAY_ORDER.map((day) => (
            <div key={day} className="flex flex-col gap-2 border-b border-ds2-border py-3 last:border-0">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-ds2-foreground">{DAY_LABELS[day]}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => addPeriod(day)}>
                  <Plus className="h-3.5 w-3.5" />
                  Período
                </Button>
              </div>

              {openingHours[day].length === 0 ? (
                <p className="text-xs text-ds2-foreground-muted">Fechado</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {openingHours[day].map((period, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={period.open}
                        onChange={(e) => updatePeriod(day, index, "open", e.target.value)}
                        disabled={isSubmitting}
                        className="w-auto"
                      />
                      <span className="text-xs text-ds2-foreground-muted">até</span>
                      <Input
                        type="time"
                        value={period.close}
                        onChange={(e) => updatePeriod(day, index, "close", e.target.value)}
                        disabled={isSubmitting}
                        className="w-auto"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePeriod(day, index)}
                        disabled={isSubmitting}
                        aria-label="Remover período"
                        className="shrink-0 text-ds2-danger hover:text-ds2-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" aria-hidden />
            Formas de pagamento
          </CardTitle>
          <CardDescription>Formas de pagamento aceitas pelo restaurante.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHOD_VALUES.map((method) => {
              const isSelected = acceptedMethods.includes(method);
              return (
                <button
                  key={method}
                  type="button"
                  onClick={() => toggleMethod(method)}
                  disabled={isSubmitting}
                  className={cn(
                    "rounded-ds2-full border px-4 py-2 text-sm font-medium transition-colors",
                    isSelected
                      ? "border-ds2-primary bg-ds2-primary/10 text-ds2-primary"
                      : "border-ds2-border text-ds2-foreground-muted hover:border-ds2-border-strong",
                  )}
                >
                  {PAYMENT_METHOD_LABELS[method]}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {errorMessage && <Alert variant="destructive">{errorMessage}</Alert>}

      <div className="flex justify-end">
        <Button type="submit" isLoading={isSubmitting}>
          Salvar operação
        </Button>
      </div>
    </form>
  );
}
