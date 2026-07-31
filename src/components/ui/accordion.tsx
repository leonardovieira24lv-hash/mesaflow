"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccordionItemProps {
  /** Controla o estado por fora (ex.: expandir automaticamente ao criar uma categoria nova). Se omitido, o item cuida do próprio estado. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  /** Conteúdo clicável que abre/fecha (título, contagem, etc.) — vai dentro do `<button>` de trigger. */
  title: ReactNode;
  /**
   * Botões extra no cabeçalho (ex.: editar/excluir categoria, alça de
   * arrastar) — renderizados FORA do `<button>` de trigger, como irmãos, já
   * que HTML não permite `<button>` dentro de `<button>`.
   */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Accordion/Collapse genérico (não existia no design system antes da Sprint
 * "Refatoração da Experiência do Cardápio", 2026-07-28) — controlado ou não
 * controlado, à escolha de quem usa.
 */
export function AccordionItem({
  open,
  onOpenChange,
  defaultOpen = false,
  title,
  actions,
  children,
  className,
}: AccordionItemProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  function toggle() {
    const next = !isOpen;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }

  return (
    <div className={cn("overflow-hidden rounded-ds2-md border border-ds2-border bg-ds2-surface", className)}>
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          className="flex flex-1 items-center gap-2.5 text-left"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-ds2-foreground-muted transition-transform duration-200",
              isOpen && "rotate-180",
            )}
            aria-hidden
          />
          {title}
        </button>

        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>

      {isOpen && <div className="border-t border-ds2-border px-4 py-4">{children}</div>}
    </div>
  );
}
