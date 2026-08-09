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
 * Sprint de reconstrução visual (2026-08-08): reescrito para usar só
 * paleta padrão do Tailwind (zinc/emerald/white), sem nenhum token do
 * design system antigo nem `ds2-*` — mesmo objetivo de sempre (hierarquia
 * clara, mobile-first), estrutura/lógica de busca 100% preservadas.
 */
export function RestaurantHeader({ restaurantName, tableName, searchTerm, onSearchChange }: RestaurantHeaderProps) {
  const hasSearch = onSearchChange !== undefined;
  return (
    <header className="flex flex-col gap-3 border-b border-zinc-200 bg-white/95 px-4 pb-3.5 pt-4 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex items-center justify-between gap-3">
        <h1 className="truncate text-xl font-bold tracking-tight text-zinc-900">{restaurantName}</h1>
        {tableName && (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            Mesa {tableName}
          </span>
        )}
      </div>

      {hasSearch && (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            aria-hidden
          />
          <input
            type="search"
            inputMode="search"
            value={searchTerm ?? ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Buscar no cardápio..."
            aria-label="Buscar produtos no cardápio"
            className="w-full rounded-full border border-zinc-200 bg-zinc-50 py-2.5 pl-9 pr-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange?.("")}
              aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </header>
  );
}
