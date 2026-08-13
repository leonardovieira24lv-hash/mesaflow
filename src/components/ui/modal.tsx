"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
 *
 * `animate-scale-in` usa sua duração/easing atuais (0.15s ease-out),
 * divergentes do padrão oficial de entrada de Modal (`ds2-duration-slow`/
 * `ds2-ease`, seção 10 do MesaFlow Visual Language) — não corrigido: essa
 * animação é compartilhada com telas públicas do Cardápio do cliente,
 * ajustar sua duração afeta lá também.
 *
 * Sprint 13.14 — renderizado via `createPortal` direto no `<body>`, não
 * mais como filho normal de quem o chama. Antes, um `<ConfirmDialog>`
 * (que usa este componente) aberto de dentro de outro `<dialog>` nativo já
 * aberto (ex.: confirmar "Cancelar item" dentro do Drawer da mesa) ficava
 * aninhado no DOM — `<dialog>` dentro de `<dialog>`, os dois abertos via
 * `showModal()`. Relatado na prática: fechar o de confirmação (mesmo só
 * dispensando, sem confirmar) às vezes fechava o de fora junto, voltando
 * pra tela anterior sem motivo. `<dialog>` aninhado tem comportamento
 * conhecidamente inconsistente entre navegadores — a correção padrão é
 * não aninhar de verdade no DOM: o portal bota este `<dialog>` como
 * filho direto do `<body>`, irmão do de fora, não descendente dele,
 * então cada um fecha só o que é seu. `mounted`/`useEffect` abaixo é só
 * pra isso funcionar em SSR (`document` não existe no servidor) — o
 * componente não tenta usar portal antes de estar rodando no navegador.
 */
export function Modal({ open, onClose, title, description, children, footer, hideHeader, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const dialogElement = (
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
        "m-auto w-full max-w-md rounded-ds2-lg border border-ds2-border bg-ds2-surface p-0 text-ds2-foreground shadow-ds2-lg",
        "backdrop:bg-black/50 backdrop:backdrop-blur-[2px]",
        "open:animate-scale-in",
        className,
      )}
    >
      {!hideHeader && (
        <div className="flex items-start justify-between gap-4 p-7 pb-4">
          <div className="flex flex-col gap-1.5">
            <h2 id="modal-title" className="font-display text-xl font-semibold tracking-tight text-ds2-foreground">
              {title}
            </h2>
            {description && <p className="text-sm text-ds2-foreground-muted">{description}</p>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-2 -mt-2 h-8 w-8 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="px-7">{children}</div>

      {footer && <div className="flex items-center justify-end gap-3 p-7 pt-5">{footer}</div>}
    </dialog>
  );

  if (!mounted) return null;
  return createPortal(dialogElement, document.body);
}
