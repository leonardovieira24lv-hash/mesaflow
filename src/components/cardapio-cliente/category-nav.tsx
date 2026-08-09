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
 *
 * Sprint "Redesign Premium do Cardápio" (2026-07-28): chips maiores e mais
 * espaçados (mais respiro entre eles, alvo de toque maior), com a
 * categoria ativa em destaque mais forte. Continuam só com o nome da
 * categoria — não existe campo de ícone/emoji em `MenuCategory` no
 * contrato atual, então nenhum ícone por categoria foi inventado aqui.
 * Lógica de rolagem/observação de seção inalterada.
 *
 * Sprint "Refinamento Premium do Cardápio" (2026-07-28, seguinte): verde
 * mantido só na categoria ativa (um dos poucos pontos de destaque pedidos
 * pelo dono). Estrutura de chips e toda a lógica de clique/scroll
 * inalteradas.
 *
 * Sprint de reconstrução visual (2026-08-08, seguinte): reescrito para usar
 * só paleta padrão do Tailwind (fundo branco, pill ativa em `emerald-500`,
 * inativa em `zinc-100`), sem nenhum token do design system antigo. Nenhuma
 * linha de lógica (estado, `IntersectionObserver`, clique/scroll, refs) foi
 * tocada — só `className`.
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
      // alta permaneça "ativa" bem depois de ter saído de vista. Offset menor
      // que antes: agora só o próprio <CategoryNav> fica fixo no topo (o
      // header de marca rola junto com a página), então a faixa reservada é
      // só a altura da barra de categorias.
      { rootMargin: "-64px 0px -60% 0px", threshold: 0 },
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
      className="sticky top-0 z-20 flex gap-2 overflow-x-auto border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/85 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => handleClick(category.id)}
          aria-current={activeId === category.id ? "true" : undefined}
          className={cn(
            "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-[background-color,color,transform,box-shadow] duration-150 active:scale-[0.96]",
            activeId === category.id
              ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
              : "border border-zinc-200 bg-zinc-100 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900",
          )}
        >
          {category.name}
        </button>
      ))}
    </nav>
  );
}
