"use client";

import { useSyncExternalStore, type CSSProperties } from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

/**
 * Store global mínimo (sem dependência externa), no padrão
 * `useSyncExternalStore`. `toast.success(...)` pode ser chamado de qualquer
 * lugar (inclusive fora de componentes React, ex.: dentro de um handler de
 * fetch); o `<Toaster />` montado no root layout é quem renderiza a fila.
 */
let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return toasts;
}

const EMPTY_TOASTS: ToastItem[] = [];

function getServerSnapshot() {
  return EMPTY_TOASTS;
}

function push(variant: ToastVariant, title: string, description?: string) {
  const id = crypto.randomUUID();
  toasts = [...toasts, { id, title, description, variant }];
  emit();
  setTimeout(() => dismiss(id), 5000);
  return id;
}

function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (title: string, description?: string) => push("success", title, description),
  error: (title: string, description?: string) => push("error", title, description),
  info: (title: string, description?: string) => push("info", title, description),
  warning: (title: string, description?: string) => push("warning", title, description),
  dismiss,
};

const VARIANT_CONFIG: Record<
  ToastVariant,
  { icon: typeof Info; className: string; role: "alert" | "status"; ariaLive: "assertive" | "polite" }
> = {
  success: { icon: CheckCircle2, className: "text-ds2-success", role: "status", ariaLive: "polite" },
  error: { icon: XCircle, className: "text-ds2-danger", role: "alert", ariaLive: "assertive" },
  info: { icon: Info, className: "text-ds2-info", role: "status", ariaLive: "polite" },
  warning: { icon: AlertTriangle, className: "text-ds2-warning", role: "status", ariaLive: "polite" },
};

/**
 * `Toast` é **autônomo** — usa tokens `ds2-*` diretamente, independente de
 * estar dentro de `.ds2-dark` ou não. `<Toaster />` é montado uma única
 * vez em `app/layout.tsx`, fora de qualquer escopo de tema (compartilhado
 * por admin, autenticação e cardápio público ao mesmo tempo) — decisão
 * arquitetural oficial: em vez de tentar herdar tema por rota, o próprio
 * container do `<Toaster />` carrega a classe `.ds2-dark`, definindo as
 * variáveis `--ds2-*` ali mesmo, onde quer que a árvore o monte. Um único
 * visual de Toast em todo o produto — sem variante clara/escura, sem
 * detecção de rota.
 *
 * Sem barra colorida lateral, de propósito — severidade só pelo ícone +
 * cor do ícone/texto, sobre uma superfície neutra (`ds2-surface`).
 *
 * `error` usa `role="alert"`/`aria-live="assertive"` (interrompe a leitura
 * do leitor de tela) — `success`/`warning`/`info` continuam
 * `role="status"`/`aria-live="polite"` (aguardam uma pausa natural).
 *
 * Monta o container global de toasts. Incluir uma única vez, no root layout.
 */
/**
 * Correção (2026-08-09, mesmo dia da remoção de `ds2-dark` do container):
 * `.ds2-dark` (`app/globals.css`) fazia DUAS coisas ao mesmo tempo — pintava
 * `background-color`/`color` diretamente em quem a carregava (a causa da
 * faixa preta global) E era a ÚNICA fonte, em toda a árvore, das variáveis
 * `--ds2-surface`/`--ds2-border`/`--ds2-foreground`/etc. que o toast
 * individual usa (`bg-ds2-surface`, `border-ds2-border`, `shadow-ds2-md`...).
 * Remover a classe inteira tirou a faixa, mas também tirou essas variáveis —
 * sem elas, cada classe `ds2-*` resolvia contra uma variável inexistente, e
 * o toast ficava sem fundo/borda/sombra/raio nenhum (aparência de HTML cru).
 *
 * Esta declaração recria só as variáveis que o toast individual realmente
 * consome (conferido por grep no arquivo, não suposição) — sem o
 * `background-color`/`color` que causava o problema original.
 *
 * `--ds2-surface`/`--ds2-border` (2026-08-09, ajuste seguinte): propositalmente
 * *mais claros* que o valor original de `.ds2-dark` (`0 0% 10%`/`0 0% 18%`) —
 * o Cardápio Público em tema escuro usa fundo `zinc-950` (bem próximo do
 * preto puro), e o valor original ficava quase indistinguível dele. `16%`/
 * `26%` dão contraste discreto o suficiente pra o toast se destacar sem
 * "brilhar" fora de contexto. As demais variáveis mantêm os valores
 * originais de `.ds2-dark`.
 */
const toasterVars = {
  "--ds2-surface": "0 0% 16%",
  "--ds2-border": "0 0% 26%",
  "--ds2-foreground": "0 0% 98%",
  "--ds2-foreground-muted": "0 0% 68%",
  "--ds2-success": "152 60% 45%",
  "--ds2-warning": "38 92% 55%",
  "--ds2-danger": "0 72% 56%",
  "--ds2-info": "210 80% 60%",
  "--ds2-shadow-md": "0 8px 20px -6px rgb(0 0 0 / 0.55), 0 2px 8px -2px rgb(0 0 0 / 0.4)",
  "--ds2-radius-md": "0.75rem",
} as CSSProperties;

export function Toaster() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
      style={toasterVars}
      role="region"
      aria-label="Notificações"
    >
      {items.map((item) => {
        const { icon: Icon, className, role, ariaLive } = VARIANT_CONFIG[item.variant];
        return (
          <div
            key={item.id}
            role={role}
            aria-live={ariaLive}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-ds2-md border border-ds2-border",
              "bg-ds2-surface p-4 text-ds2-foreground shadow-ds2-md animate-toast-in",
            )}
          >
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", className)} aria-hidden />
            <div className="flex-1">
              <p className="text-sm font-medium">{item.title}</p>
              {item.description && <p className="mt-0.5 text-sm text-ds2-foreground-muted">{item.description}</p>}
            </div>
            <button
              onClick={() => dismiss(item.id)}
              aria-label="Dispensar notificação"
              className="text-ds2-foreground-muted transition-colors hover:text-ds2-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
