import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size">;

/**
 * Switch (toggle) — usado principalmente para `is_available` de produtos e
 * ativação binária de configurações. Mesmo padrão de acessibilidade do
 * Checkbox: input nativo escondido + trilho/thumb visual via `peer`.
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(({ className, id, ...props }, ref) => {
  return (
    <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
      <input
        ref={ref}
        id={id}
        type="checkbox"
        role="switch"
        className={cn("peer absolute inset-0 z-10 cursor-pointer opacity-0", className)}
        {...props}
      />
      <span
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full bg-muted transition-colors",
          "peer-checked:bg-primary",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute left-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform",
          "peer-checked:translate-x-5",
        )}
      />
    </span>
  );
});
Switch.displayName = "Switch";
