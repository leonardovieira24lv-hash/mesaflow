import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes } from "react";
import { buttonVariants, type ButtonVariant, type ButtonSize } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonLinkProps = LinkProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
  };

/** `<Link>` do Next.js com a aparência de `<Button>` — navegação, nunca ação/submit. */
export function ButtonLink({ className, variant = "primary", size = "md", ...props }: ButtonLinkProps) {
  return <Link className={cn(buttonVariants(variant, size), className)} {...props} />;
}
