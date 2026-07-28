"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Rede de segurança da rota `/dashboard` (convenção `error.tsx` do App
 * Router). As seções individuais já tratam seus próprios erros de fetch
 * (`SectionError`, dentro de cada Server Component) — isto só cobre uma
 * falha inesperada que escape delas (ex.: erro ao resolver a sessão).
 */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[dashboard-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium">Não foi possível carregar o Dashboard</p>
        <p className="text-sm text-muted-foreground">Tente novamente em instantes.</p>
      </div>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
