import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** Skeleton do cabeçalho de status (nome do restaurante + badge). */
export function StatusHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <SkeletonText width="240px" className="h-8" />
      <SkeletonText width="160px" />
    </div>
  );
}

/** Skeleton dos 4 cards de resumo. */
export function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex flex-col gap-2 p-5">
            <SkeletonText width="60%" />
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Skeleton do checklist de onboarding. */
export function ChecklistSkeleton() {
  return (
    <Card>
      <CardHeader>
        <SkeletonText width="180px" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded-full" />
            <SkeletonText width="50%" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Skeleton da lista de últimos pedidos. */
export function RecentOrdersSkeleton() {
  return (
    <Card>
      <CardHeader>
        <SkeletonText width="160px" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <SkeletonText width="40%" />
            <SkeletonText width="20%" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
