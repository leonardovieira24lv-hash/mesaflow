import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { step: 1, label: "Sua conta" },
  { step: 2, label: "Mesas" },
  { step: 3, label: "QR Codes" },
] as const;

/**
 * Indicador de progresso do onboarding (3 passos). Puramente visual —
 * cada página do fluxo informa em qual passo está; não há navegação livre
 * entre passos (o onboarding é sequencial por design).
 */
export function OnboardingProgress({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="mb-8 flex items-center justify-center gap-2" aria-label="Progresso do cadastro">
      {STEPS.map(({ step, label }, i) => {
        const state = step < current ? "done" : step === current ? "current" : "upcoming";
        return (
          <li key={step} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs font-semibold",
                  state === "done" && "bg-primary text-primary-foreground",
                  state === "current" && "bg-primary/10 text-primary ring-2 ring-primary",
                  state === "upcoming" && "bg-muted text-muted-foreground",
                )}
              >
                {state === "done" ? <Check className="h-3.5 w-3.5" /> : step}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  state === "upcoming" ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
