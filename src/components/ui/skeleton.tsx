import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Bloco base de skeleton. Compor formas específicas (linha, círculo, card) via className. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-skeleton-pulse rounded-md bg-muted", className)}
      role="presentation"
      aria-hidden
      {...props}
    />
  );
}

/** Skeleton de uma linha de texto (título ou parágrafo curto). */
export function SkeletonText({ className, width = "100%" }: { className?: string; width?: string }) {
  return <Skeleton className={cn("h-4", className)} style={{ width }} />;
}

/** Skeleton de avatar/ícone circular. */
export function SkeletonAvatar({ className }: { className?: string }) {
  return <Skeleton className={cn("h-10 w-10 rounded-full", className)} />;
}

/** Skeleton de um card inteiro (ex.: card de pedido carregando). */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface p-6", className)}>
      <div className="flex items-center gap-3">
        <SkeletonAvatar />
        <div className="flex flex-1 flex-col gap-2">
          <SkeletonText width="40%" />
          <SkeletonText width="60%" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton de linha de tabela — usar dentro de <TableBody> enquanto a listagem carrega. */
export function SkeletonTableRow({ columns }: { columns: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <SkeletonText width={i === 0 ? "70%" : "50%"} />
        </td>
      ))}
    </tr>
  );
}
