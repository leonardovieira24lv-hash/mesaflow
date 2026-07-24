"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  /** Esconde o cabeçalho de título/descrição (ex.: modal só com conteúdo customizado). */
  hideHeader?: boolean;
  className?: string;
}

/**
 * Modal base do MesaFlow, construído sobre `<dialog>` nativo: foco preso
 * automaticamente dentro do modal, tecla Esc fecha, `::backdrop` cuida do
 * overlay — sem reimplementar nada disso manualmente.
 *
 * Para confirmações (excluir, cancelar), preferir `<ConfirmDialog>`, que já
 * usa este componente por baixo com o rótulo/variante certos.
 */
export function Modal({ open, onClose, title, description, children, footer, hideHeader, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        // Fecha ao clicar no backdrop (fora do <div> de conteúdo).
        if (e.target === ref.current) onClose();
      }}
      // `hideHeader` omite o `<h2 id="modal-title">` — sem isso,
      // `aria-labelledby="modal-title"` fixo apontaria para um id
      // inexistente e o diálogo ficaria sem nome acessível para leitores de
      // tela. Sprint 10 (auditoria): nenhum consumidor usa `hideHeader` hoje,
      // mas corrigido aqui porque é o tipo de bug que só aparece quando
      // alguém finalmente usar a opção — melhor não deixar a armadilha.
      aria-labelledby={hideHeader ? undefined : "modal-title"}
      aria-label={hideHeader ? title : undefined}
      className={cn(
        "m-auto w-full max-w-md rounded-lg border border-border bg-surface p-0 text-surface-foreground shadow-lg",
        "backdrop:bg-foreground/40 backdrop:backdrop-blur-[2px]",
        "open:animate-scale-in",
        className,
      )}
    >
      {!hideHeader && (
        <div className="flex items-start justify-between gap-4 p-6 pb-3">
          <div className="flex flex-col gap-1">
            <h2 id="modal-title" className="font-display text-lg font-semibold">
              {title}
            </h2>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-2 -mt-2 h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="px-6">{children}</div>

      {footer && <div className="flex items-center justify-end gap-3 p-6 pt-4">{footer}</div>}
    </dialog>
  );
}
