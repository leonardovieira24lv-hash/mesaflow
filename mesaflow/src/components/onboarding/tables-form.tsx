"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, Printer } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { TableQrCode } from "@/components/onboarding/table-qr-code";
import { getOnboardingSlug } from "@/lib/onboarding-session";
import { createTablesSchema } from "@/lib/validations/onboarding";
import type { ApiError } from "@/types/api";

interface CreatedTable {
  id: string;
  name: string;
  qr_token: string;
}

/** Passos 2 e 3 do onboarding: quantidade de mesas + revisão dos QR Codes (contrato seção 2.2 e 7.5). */
export function TablesForm() {
  const router = useRouter();
  const [stage, setStage] = useState<"quantity" | "review">("quantity");

  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tables, setTables] = useState<CreatedTable[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);

  async function handleCreateTables(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const result = createTablesSchema.safeParse({ quantity: Number(quantity) });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Quantidade inválida.");
      return;
    }
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/onboarding/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: result.data.quantity }),
      });
      const body = await response.json();

      if (!response.ok) {
        const apiError = body as ApiError;
        setError(apiError.error?.message ?? "Não foi possível criar as mesas.");
        setIsSubmitting(false);
        return;
      }

      setTables(body.data as CreatedTable[]);
      setStage("review");
      setIsSubmitting(false);
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
      setIsSubmitting(false);
    }
  }

  async function handleConfirmPrint() {
    setIsConfirming(true);
    try {
      const response = await fetch("/api/v1/tables/qr-codes/print-confirmation", { method: "POST" });
      const body = await response.json();

      if (!response.ok) {
        const apiError = body as ApiError;
        toast.error("Não foi possível confirmar", apiError.error?.message);
        setIsConfirming(false);
        return;
      }

      toast.success("Tudo pronto!", "Seu restaurante já está ativo no MesaFlow.");
      router.push(ROUTES.dashboard);
    } catch {
      toast.error("Não foi possível conectar", "Verifique sua internet e tente novamente.");
      setIsConfirming(false);
    }
  }

  const slug = getOnboardingSlug();
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  if (stage === "review") {
    return (
      <div className="w-full max-w-2xl">
        <OnboardingProgress current={3} />
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1 text-center">
            <h1 className="font-display text-2xl font-semibold">Seus QR Codes estão prontos</h1>
            <p className="text-sm text-muted-foreground">
              Imprima e cole um em cada mesa. Cada código leva o cliente direto ao cardápio daquela mesa.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {tables.map((table) => (
              <TableQrCode
                key={table.id}
                tableName={table.name}
                url={slug ? `${origin}/${slug}/mesa/${table.qr_token}` : table.qr_token}
              />
            ))}
          </div>

          <Button onClick={handleConfirmPrint} isLoading={isConfirming} className="w-full">
            <Printer className="h-4 w-4" />
            Confirmar impressão e concluir
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <OnboardingProgress current={2} />
      <form onSubmit={handleCreateTables} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="font-display text-2xl font-semibold">Quantas mesas o seu salão tem?</h1>
          <p className="text-sm text-muted-foreground">
            Criamos automaticamente uma mesa numerada para cada uma, com QR Code próprio.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">{error}</Alert>
        )}

        <FormField label="Número de mesas">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            leadingIcon={<LayoutGrid />}
            placeholder="Ex.: 12"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={isSubmitting}
          />
        </FormField>

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Criar mesas
        </Button>
      </form>
    </div>
  );
}
