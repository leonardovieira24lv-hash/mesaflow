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
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-12 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted ring-1 ring-inset ring-border">
          <Icon className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
