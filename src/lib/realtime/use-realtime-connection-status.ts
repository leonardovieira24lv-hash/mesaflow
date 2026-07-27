"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Sprint 2 (Painel Vivo). Status de conexão de um canal Supabase Realtime,
 * já traduzido dos valores brutos que `.subscribe(callback)` entrega
 * (`SUBSCRIBED`, `TIMED_OUT`, `CHANNEL_ERROR`, `CLOSED`) para algo que a UI
 * consegue rotular diretamente.
 */
export type RealtimeConnectionStatus = "connecting" | "connected" | "reconnecting" | "offline";

function normalize(rawStatus: string): RealtimeConnectionStatus {
  switch (rawStatus) {
    case "SUBSCRIBED":
      return "connected";
    case "TIMED_OUT":
    case "CHANNEL_ERROR":
      // O client do Supabase já tenta reconectar sozinho nesses casos —
      // "reconnecting" é mais honesto para quem opera do que "offline".
      return "reconnecting";
    case "CLOSED":
      return "offline";
    default:
      return "connecting";
  }
}

// Do pior para o melhor — o status agregado de vários canais é sempre o
// pior entre eles (se um canal caiu, o indicador não pode dizer "Ao vivo").
const SEVERITY: RealtimeConnectionStatus[] = ["offline", "reconnecting", "connecting", "connected"];

/**
 * Um componente que assina N canais (ex.: `TablesManager` assina `orders` e
 * `tables`) chama `reportStatus(chave, status)` dentro do callback que já
 * passa para `.subscribe()` de cada canal — nenhum canal novo é criado só
 * para monitorar conexão, o hook apenas observa os canais que já existem.
 * `channelKeys` define quais chaves compõem o agregado (e o status inicial
 * "connecting" de cada uma, antes do primeiro callback chegar).
 */
export function useRealtimeConnectionStatus(channelKeys: string[]) {
  const [statuses, setStatuses] = useState<Record<string, RealtimeConnectionStatus>>(() =>
    Object.fromEntries(channelKeys.map((key) => [key, "connecting"])),
  );

  const reportStatus = useCallback((key: string, rawStatus: string) => {
    const next = normalize(rawStatus);
    setStatuses((prev) => (prev[key] === next ? prev : { ...prev, [key]: next }));
  }, []);

  const status = useMemo(() => {
    const values = Object.values(statuses);
    for (const level of SEVERITY) {
      if (values.includes(level)) return level;
    }
    return "connecting" as const;
  }, [statuses]);

  return { status, reportStatus };
}
