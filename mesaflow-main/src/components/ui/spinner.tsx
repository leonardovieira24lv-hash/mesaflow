import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
} as const;

interface SpinnerProps {
  size?: keyof typeof sizeClasses;
  className?: string;
  /** Texto lido por leitores de tela (o spinner em si é `aria-hidden`). */
  label?: string;
}

/** Indicador de carregamento inline — usar dentro de botões, cards ou seções pequenas. */
export function Spinner({ size = "md", className, label = "Carregando" }: SpinnerProps) {
  return (
    <span role="status" className="inline-flex items-center">
      <Loader2 className={cn("animate-spin text-muted-foreground", sizeClasses[size], className)} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Carregamento de página inteira ou de uma seção grande (ex.: troca de rota, fetch inicial). */
export function PageLoading({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
      <Spinner size="lg" label={label} />
      <p className="text-sm text-muted-foreground">{label}...</p>
    </div>
  );
}
