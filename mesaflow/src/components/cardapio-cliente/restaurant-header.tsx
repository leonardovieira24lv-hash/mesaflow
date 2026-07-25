interface RestaurantHeaderProps {
  restaurantName: string;
  tableName?: string;
}

/**
 * Hero de marca do cardápio do cliente (Fase 3, item 2: "Exibição das
 * informações do restaurante"). Puramente apresentacional — sem estado, sem
 * `"use client"` — para poder ser renderizado direto pelo Server Component
 * da página quando não há mesa (ex.: acesso ao cardápio sem QR Code).
 *
 * Sprint "UI Premium": deixou de ser uma barra fixa e virou um bloco de
 * abertura que rola junto com a página — é o primeiro instante depois do
 * scan do QR Code, então carrega a marca (gradiente + tipografia grande) em
 * vez de só repetir o nome em texto plano. Quem assume o posto fixo no topo
 * a partir daqui é o `<CategoryNav>`, como em apps de delivery de
 * referência (a identidade aparece uma vez, a navegação é o que persiste).
 */
export function RestaurantHeader({ restaurantName, tableName }: RestaurantHeaderProps) {
  return (
    <header className="relative overflow-hidden bg-gradient-to-br from-primary to-[hsl(var(--primary-deep))] px-5 pb-7 pt-9 shadow-hero">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-white/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-primary-foreground/80">
          Cardápio digital
        </span>
        <div className="flex items-end justify-between gap-3">
          <h1 className="truncate font-display text-3xl font-bold tracking-tight text-primary-foreground">
            {restaurantName}
          </h1>
          {tableName && (
            <span className="shrink-0 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 font-mono text-xs font-medium text-primary-foreground backdrop-blur-sm">
              Mesa {tableName}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
