"use client";

import { Search, X } from "lucide-react";

interface RestaurantHeaderProps {
  restaurantName: string;
  tableName?: string;
  /** Opcionais: só o Cardápio (`<CardapioClienteView>`) passa isso — Carrinho, Checkout e Acompanhamento de Pedido continuam sem busca, pois não fazem sentido nessas telas. */
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
}

/**
 * Cabeçalho do cardápio do cliente (Fase 3, item 2: "Exibição das
 * informações do restaurante").
 *
 * Sprint "Redesign Premium do Cardápio" (2026-07-28): ganhou uma busca
 * elegante integrada (filtra os produtos já carregados por nome/descrição —
 * estado local em `<CardapioClienteView>`, nenhuma chamada nova de API).
 * Deliberadamente NÃO inclui indicador de "Aberto/Fechado" nem "tempo
 * médio de entrega": `Restaurant` no contrato atual (`src/types/domain.ts`)
 * não tem campo de status operacional nem de tempo estimado — só
 * `id/name/slug/status` (status de onboarding, não de "aberto agora").
 * Inventar esses dois indicadores aqui seria fabricar informação (ex.: todo
 * restaurante sempre "Aberto"), o que o próprio projeto já evitou em telas
 * anteriores. Ficam como candidatos a uma sprint futura que adicione esses
 * campos de verdade ao contrato/banco.
 *
 * Sprint "Refinamento Premium do Cardápio" (2026-07-28, seguinte): o
 * banner verde cheio (`bg-gradient-to-r from-primary...`) foi trocado por
 * um fundo neutro (branco/`--surface`) com uma borda inferior sutil —
 * pedido explícito do dono de reduzir o verde a poucos pontos de destaque
 * (preço, botão "+", categoria ativa). Como este componente é reaproveitado
 * por Carrinho/Checkout/Acompanhamento de Pedido, a mudança de cor também
 * aparece nessas telas — nenhuma delas teve estrutura ou lógica alterada,
 * só essa cor de fundo compartilhada.
 *
 * Sprint "Redesign Completo do Cardápio Público" (2026-07-29, seguinte):
 * nome do restaurante ganhou mais peso tipográfico (`text-xl`, era
 * `text-lg`) — parte da mesma sprint que redesenhou os cards de produto e
 * a paleta; estrutura do cabeçalho em si não mudou.
 */
export function RestaurantHeader({ restaurantName, tableName, searchTerm, onSearchChange }: RestaurantHeaderProps) {
  const hasSearch = onSearchChange !== undefined;
  return (
    <header className="relative flex flex-col gap-3 border-b border-ds2-border bg-ds2-surface px-4 pb-3.5 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="truncate text-xl font-bold tracking-tight text-ds2-foreground">
          {restaurantName}
        </h1>
        {tableName && (
          <span className="shrink-0 rounded-full border border-ds2-border bg-ds2-surface-hover px-2.5 py-1 text-[11px] font-medium text-ds2-foreground-muted">
            Mesa {tableName}
          </span>
        )}
      </div>

      {hasSearch && (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds2-foreground-muted"
            aria-hidden
          />
          <input
            type="search"
            inputMode="search"
            value={searchTerm ?? ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Buscar no cardápio..."
            aria-label="Buscar produtos no cardápio"
            className="w-full rounded-full border border-ds2-border bg-ds2-surface-hover/60 py-2.5 pl-9 pr-9 text-sm text-ds2-foreground placeholder:text-ds2-foreground-muted focus:border-ds2-primary/40 focus:outline-none focus:ring-2 focus:ring-ds2-primary/20"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange?.("")}
              aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-ds2-foreground-muted transition-colors hover:bg-ds2-surface-hover hover:text-ds2-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </header>
  );
}
