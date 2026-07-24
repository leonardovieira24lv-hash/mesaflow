"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CategoryNavProps {
  categories: { id: string; name: string }[];
}

/** Prefixo do `id` de cada seção de categoria na página — usado tanto aqui quanto em `<CardapioClienteView>`. */
export function categorySectionId(categoryId: string): string {
  return `categoria-${categoryId}`;
}

/**
 * Barra de categorias fixa logo abaixo do cabeçalho (Fase 3, item 6:
 * "Navegação entre categorias"). Clicar rola até a seção; a categoria
 * destacada acompanha automaticamente o scroll via `IntersectionObserver` —
 * comportamento padrão de cardápio de delivery, familiar para quem usa o
 * celular para pedir comida.
 */
export function CategoryNav({ categories }: CategoryNavProps) {
  const [activeId, setActiveId] = useState(categories[0]?.id);

  useEffect(() => {
    const sections = categories
      .map((category) => document.getElementById(categorySectionId(category.id)))
      .filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) {
          setActiveId(visible.target.id.replace("categoria-", ""));
        }
      },
      // Considera "ativa" a seção que cruza a faixa logo abaixo da barra de
      // navegação, ignorando o resto da tela — evita que uma seção muito
      // alta permaneça "ativa" bem depois de ter saído de vista.
      { rootMargin: "-140px 0px -60% 0px", threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [categories]);

  if (categories.length === 0) return null;

  function handleClick(categoryId: string) {
    setActiveId(categoryId);
    document.getElementById(categorySectionId(categoryId))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav
      aria-label="Categorias do cardápio"
      className="sticky top-16 z-10 flex gap-2 overflow-x-auto border-b border-border bg-background px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => handleClick(category.id)}
          aria-current={activeId === category.id ? "true" : undefined}
          className={cn(
            "shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.98]",
            activeId === category.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/70",
          )}
        >
          {category.name}
        </button>
      ))}
    </nav>
  );
}
