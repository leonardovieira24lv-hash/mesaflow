"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "destructive" para exclusões/cancelamentos; "primary" para confirmações neutras. */
  variant?: "primary" | "destructive";
  onConfirm: () => void;
  isConfirming?: boolean;
}

/**
 * Diálogo de confirmação padrão — usar antes de qualquer ação irreversível
 * (excluir categoria, cancelar pedido, remover mesa). Nunca disparar a ação
 * direto de um clique sem passar por aqui.
 *
 * Ex.: excluir uma categoria com produtos vinculados (409 CONFLICT, seção
 * 5.4 do contrato) — a UI chama isto, e só na confirmação chama a API.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "primary",
  onConfirm,
  isConfirming,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isConfirming}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} isLoading={isConfirming}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
