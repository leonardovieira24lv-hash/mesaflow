interface RestaurantHeaderProps {
  restaurantName: string;
  tableName?: string;
}

/**
 * Cabeçalho fixo do cardápio do cliente (Fase 3, item 2: "Exibição das
 * informações do restaurante"). Puramente apresentacional — sem estado, sem
 * `"use client"` — para poder ser renderizado direto pelo Server Component
 * da página quando não há mesa (ex.: acesso ao cardápio sem QR Code).
 */
export function RestaurantHeader({ restaurantName, tableName }: RestaurantHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center justify-between gap-3">
        <h1 className="truncate font-display text-xl font-semibold text-foreground">{restaurantName}</h1>
        {tableName && (
          <span className="shrink-0 rounded-full bg-muted px-3 py-1 font-mono text-xs font-medium text-muted-foreground">
            Mesa {tableName}
          </span>
        )}
      </div>
    </header>
  );
}
