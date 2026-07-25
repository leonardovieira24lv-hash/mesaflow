interface RestaurantHeaderProps {
  restaurantName: string;
  tableName?: string;
}

/**
 * Cabeçalho do cardápio do cliente (Fase 3, item 2: "Exibição das
 * informações do restaurante"). Puramente apresentacional — sem estado, sem
 * `"use client"` — para poder ser renderizado direto pelo Server Component
 * da página quando não há mesa (ex.: acesso ao cardápio sem QR Code).
 *
 * Sprint de Refinamento Premium do Cardápio (pedido explícito do dono:
 * "cabeçalho ocupa espaço demais... reduza a altura... evite banners
 * grandes"): voltou a ser uma barra compacta — mantém o gradiente de marca
 * (identidade do MesaFlow), mas sem os blobs decorativos nem a tipografia
 * grande da versão anterior ("hero de abertura"). Só o essencial: nome do
 * restaurante e mesa. Não existe campo de logo nem de status
 * aberto/fechado no contrato do restaurante — não inventados aqui.
 */
export function RestaurantHeader({ restaurantName, tableName }: RestaurantHeaderProps) {
  return (
    <header className="relative flex items-center justify-between gap-3 bg-gradient-to-r from-primary to-[hsl(var(--primary-deep))] px-4 py-3">
      <h1 className="truncate font-display text-lg font-bold tracking-tight text-primary-foreground">
        {restaurantName}
      </h1>
      {tableName && (
        <span className="shrink-0 rounded-full border border-white/25 bg-white/15 px-2.5 py-1 font-numeric text-[11px] font-medium text-primary-foreground">
          Mesa {tableName}
        </span>
      )}
    </header>
  );
}
