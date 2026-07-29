"use client";

import { Button } from "@/components/ui/button";

export type ProductStatusFilterValue = "active" | "archived" | "all";

const OPTIONS: { value: ProductStatusFilterValue; label: string }[] = [
  { value: "active", label: "Ativos" },
  { value: "archived", label: "Arquivados" },
  { value: "all", label: "Todos" },
];

interface ProductStatusFilterProps {
  value: ProductStatusFilterValue;
  onChange: (value: ProductStatusFilterValue) => void;
}

/**
 * Filtro segmentado da tela de Cardápio (Sprint "Arquivamento — Visualizar
 * e Restaurar", 2026-07-28) — "Ativos" (padrão), "Arquivados" ou "Todos".
 * Componente pequeno e específico desta tela; não virou primitivo de
 * `ui/` porque as 3 opções são fixas e não há outro lugar do produto que
 * precise de um segmented control genérico ainda.
 */
export function ProductStatusFilter({ value, onChange }: ProductStatusFilterProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1" role="tablist" aria-label="Filtrar produtos por status">
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? "primary" : "ghost"}
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
