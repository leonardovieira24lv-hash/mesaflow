import { cn } from "@/lib/utils";
import type { RealtimeConnectionStatus } from "@/lib/realtime/use-realtime-connection-status";

const CONFIG: Record<
  RealtimeConnectionStatus,
  { label: string; dotClass: string; textClass: string; pulse: boolean }
> = {
  connected: { label: "Ao vivo", dotClass: "bg-ds2-success", textClass: "text-ds2-success", pulse: true },
  connecting: {
    label: "Conectando…",
    dotClass: "bg-ds2-foreground-muted",
    textClass: "text-ds2-foreground-muted",
    pulse: false,
  },
  reconnecting: { label: "Reconectando…", dotClass: "bg-ds2-warning", textClass: "text-ds2-warning", pulse: true },
  offline: { label: "Sem conexão", dotClass: "bg-ds2-danger", textClass: "text-ds2-danger", pulse: false },
};

/**
 * Sprint 2 (Painel Vivo) — indicador de conexão do Supabase Realtime.
 * Não assina nada sozinho: quem já assina os canais (`TablesManager`,
 * `OrdersList`, `DashboardRealtimeSync`) usa `useRealtimeConnectionStatus`
 * e repassa o resultado aqui via prop `status`. "Ao vivo"/"Reconectando"
 * ganham um pulso sutil (`animate-ping`, ~1 ciclo por segundo, nunca uma
 * pulsação chamativa) só no ponto — o rótulo ao lado fica estático, para
 * não virar uma distração constante no canto da tela.
 */
export function RealtimeStatusIndicator({
  status,
  className,
}: {
  status: RealtimeConnectionStatus;
  className?: string;
}) {
  const config = CONFIG[status];

  return (
    <span
      role="status"
      aria-live="polite"
      title={config.label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-ds2-full bg-ds2-surface-hover px-2.5 py-1 text-xs font-medium ring-1 ring-inset ring-ds2-border",
        config.textClass,
        className,
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {config.pulse && (
          <span
            aria-hidden
            className={cn("absolute inline-flex h-full w-full animate-ping rounded-ds2-full opacity-75", config.dotClass)}
          />
        )}
        <span aria-hidden className={cn("relative inline-flex h-1.5 w-1.5 rounded-ds2-full", config.dotClass)} />
      </span>
      {config.label}
    </span>
  );
}
