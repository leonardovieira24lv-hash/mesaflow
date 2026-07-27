"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bug, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import {
  clearMesasDebugLog,
  getMesasDebugLog,
  subscribeMesasDebugLog,
  type MesasDebugLogEntry,
} from "@/lib/debug/mesas-debug-log";

/**
 * PÁGINA TEMPORÁRIA — Sprint 2 (Painel Vivo), investigação do bug "card da
 * mesa não mostra pedido em aberto / cor não muda". Criada porque o
 * desenvolvimento está sendo feito só pelo celular (Android + Termux), sem
 * DevTools/F12 disponível para ver o console do navegador durante o teste.
 *
 * Mostra, em ordem cronológica reversa (mais recente primeiro), tudo que
 * `pushMesasDebugLog()` registrou em `tables-manager.tsx` nos 6 pontos da
 * cadeia (evento Realtime → callback do canal → estado React → resposta de
 * fetch → `deriveTableCardState()` → classe de cor aplicada no render).
 *
 * Como os dados vivem num singleton de módulo (`lib/debug/mesas-debug-log.ts`),
 * eles sobrevivem à navegação client-side entre `/mesas` e esta página (sem
 * recarregar), mas são ZERADOS por um F5 de verdade — por isso a tela avisa
 * isso explicitamente abaixo. "Limpar logs" também zera a numeração — a ideia
 * é: limpar, reproduzir UM teste isolado, mandar a sequência inteira sem
 * misturar com execuções anteriores.
 *
 * Remover este arquivo, `lib/debug/mesas-debug-log.ts` e o link "Ver logs de
 * debug" em `tables-manager.tsx` assim que a causa raiz for confirmada e
 * corrigida.
 */

type LogCategory = "error" | "realtime" | "aggregation" | "state" | "other";

/**
 * Classifica cada entrada pela tag que `pushMesasDebugLog` já usa em
 * `tables-manager.tsx` — sem precisar mudar nada lá, só interpretando o texto
 * que já existe. Ordem importa: erro tem prioridade sobre as outras
 * categorias (ex.: "fetchOperations: resposta não-ok" é erro, não agregação).
 */
function categorize(tag: string): LogCategory {
  if (tag.includes("exceção") || tag.includes("não-ok") || tag.toLowerCase().includes("erro")) return "error";
  if (tag.startsWith("canal ") || tag === "setTables: mesa atualizada via realtime") return "realtime";
  if (
    tag.startsWith("fetchOperations") ||
    tag.startsWith("fetchTables") ||
    tag.startsWith("setOperations") ||
    tag.startsWith("aggregateByTable") ||
    tag.startsWith("operations: estado React confirmado")
  ) {
    return "aggregation";
  }
  if (tag === "deriveTableCardState" || tag === "render do card da mesa" || tag.startsWith("TableDrawer")) {
    return "state";
  }
  return "other";
}

const CATEGORY_STYLES: Record<LogCategory, { card: string; badge: string; label: string }> = {
  error: {
    card: "border-destructive/40 bg-destructive/10",
    badge: "bg-destructive/20 text-destructive",
    label: "Erro",
  },
  realtime: {
    card: "border-info/40 bg-info/10",
    badge: "bg-info/20 text-info",
    label: "Realtime",
  },
  aggregation: {
    card: "border-warning/40 bg-warning/10",
    badge: "bg-warning/20 text-warning",
    label: "Agregação",
  },
  state: {
    card: "border-success/40 bg-success/10",
    badge: "bg-success/20 text-success",
    label: "Estado da mesa",
  },
  other: {
    card: "border-border bg-surface",
    badge: "bg-muted text-muted-foreground",
    label: "Outro",
  },
};

export default function MesasDebugPage() {
  const [entries, setEntries] = useState<MesasDebugLogEntry[]>([]);

  useEffect(() => {
    setEntries(getMesasDebugLog());
    return subscribeMesasDebugLog(setEntries);
  }, []);

  const reversed = [...entries].reverse();

  async function handleCopy() {
    const payload = JSON.stringify(entries, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      toast.success("Logs copiados", `${entries.length} ${entries.length === 1 ? "entrada" : "entradas"} na área de transferência.`);
    } catch {
      toast.error("Não foi possível copiar automaticamente. Selecione o texto manualmente.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-foreground">Debug — Fluxo de Mesas</h1>
          <div className="flex items-center gap-2">
            <Link href="/mesas" className="text-xs font-medium text-primary hover:underline">
              Voltar para Mesas
            </Link>
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={entries.length === 0}>
              <Copy className="h-3.5 w-3.5" />
              Copiar logs
            </Button>
            <Button variant="outline" size="sm" onClick={() => clearMesasDebugLog()} disabled={entries.length === 0}>
              <Trash2 className="h-3.5 w-3.5" />
              Limpar logs
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {entries.length} {entries.length === 1 ? "entrada" : "entradas"} — instrumentação temporária, só para esta
          investigação. Um F5 zera a lista (e a numeração); navegar pelos links do menu não zera. Para não misturar
          execuções: limpe os logs, reproduza um único teste, e mande a sequência inteira.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {(Object.keys(CATEGORY_STYLES) as LogCategory[])
            .filter((c) => c !== "other")
            .map((category) => (
              <span
                key={category}
                className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", CATEGORY_STYLES[category].badge)}
              >
                {CATEGORY_STYLES[category].label}
              </span>
            ))}
        </div>
      </div>

      {reversed.length === 0 ? (
        <EmptyState
          icon={Bug}
          title="Nenhum log ainda"
          description="Abra a tela Mesas em outra aba/volte para ela e reproduza o teste (criar pedido, mudar status em Pedidos). As entradas aparecem aqui em tempo real."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {reversed.map((entry) => {
            const category = categorize(entry.tag);
            const style = CATEGORY_STYLES[category];
            return (
              <div key={entry.id} className={cn("rounded-xl border p-3 shadow-card", style.card)}>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                      #{entry.id}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", style.badge)}>
                      {style.label}
                    </span>
                    <span className="font-mono text-[11px] font-medium text-foreground">{entry.tag}</span>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {new Date(entry.at).toLocaleTimeString("pt-BR", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}.
                    {new Date(entry.at).getMilliseconds().toString().padStart(3, "0")}
                  </span>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-2 font-mono text-[11px] leading-relaxed text-foreground">
                  {JSON.stringify(entry.data, null, 2)}
                </pre>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
