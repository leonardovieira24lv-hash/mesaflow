import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { inputBaseClasses, inputInvalidClasses } from "@/components/ui/input";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, rows = 4, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={invalid || undefined}
        className={cn(
          inputBaseClasses,
          "h-auto resize-y py-2 leading-relaxed",
          invalid && inputInvalidClasses,
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
