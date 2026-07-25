import { useId, type ReactElement, cloneElement } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  /** Controle do campo (Input, Select, Textarea...) — recebe id/aria-describedby automaticamente. */
  children: ReactElement<{ id?: string; invalid?: boolean; "aria-describedby"?: string }>;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
}

/**
 * Envolve um controle de formulário com label, dica e mensagem de erro,
 * já ligados via `aria-describedby`/`aria-invalid` — este é o padrão que
 * todo formulário do painel deve usar em vez de montar label/input soltos.
 *
 * Uso:
 *   <FormField label="Nome da categoria" error={errors.name}>
 *     <Input {...register("name")} />
 *   </FormField>
 */
export function FormField({ label, children, hint, error, required, className }: FormFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden>
            *
          </span>
        )}
      </Label>

      {cloneElement(children, { id, invalid: Boolean(error), "aria-describedby": describedBy })}

      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
