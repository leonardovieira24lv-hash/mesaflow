import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Estado vazio — usar sempre que uma listagem não tiver itens (nenhuma
 * categoria cadastrada, nenhum pedido ainda, etc.). O título deve dizer o
 * que falta e a ação deve ser o próximo passo óbvio, nunca só "vazio".
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-ds2-md border border-dashed border-ds2-border bg-ds2-surface-hover/20 p-12 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-ds2-full bg-ds2-surface-hover ring-1 ring-inset ring-ds2-border">
          <Icon className="h-6 w-6 text-ds2-foreground-muted" aria-hidden />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className="font-medium text-ds2-foreground">{title}</p>
        {description && <p className="text-sm text-ds2-foreground-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
