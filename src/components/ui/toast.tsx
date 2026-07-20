"use client";

import { useSyncExternalStore } from "react";
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

const VARIANT_CONFIG: Record<ToastVariant, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: "text-success" },
  error: { icon: XCircle, className: "text-destructive" },
  info: { icon: Info, className: "text-info" },
  warning: { icon: AlertTriangle, className: "text-warning" },
};

/** Monta o container global de toasts. Incluir uma única vez, no root layout. */
export function Toaster() {
  const items = useSyncExternalStore(subscribe, getSnapshot, () => []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
      role="region"
      aria-label="Notificações"
    >
      {items.map((item) => {
        const { icon: Icon, className } = VARIANT_CONFIG[item.variant];
        return (
          <div
            key={item.id}
            role="status"
            aria-live="polite"
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-border",
              "bg-surface p-4 text-surface-foreground shadow-lg animate-toast-in",
            )}
          >
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", className)} aria-hidden />
            <div className="flex-1">
              <p className="text-sm font-medium">{item.title}</p>
              {item.description && (
                <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(item.id)}
              aria-label="Dispensar notificação"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
