"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface CategoryNavProps {
  categories: {
    id: string;
    name: string;
    // Foto de categoria (2026-08-15) — ideia do dono, inspirada num
    // concorrente: círculos com foto em vez de pílula de texto puro.
    imageUrl: string | null;
    // Só o necessário pro fallback "foto do 1º produto" — não precisa do
    // `PublicMenuItem` inteiro aqui.
    items: { image_url?: string }[];
  }[];
}

/**
 * Foto de exibição de UMA categoria, em cascata (2026-08-15): foto
 * própria da categoria → foto do 1º produto cadastrado nela → `null`
 * (cai pras iniciais do nome). Ideia do dono, reconhecendo que nem todo
 * dono de restaurante vai querer subir foto categoria por categoria —
 * o fallback garante que o círculo nunca fica genérico à toa quando já
 * existe alguma foto disponível.
 */
function resolveCategoryImage(category: CategoryNavProps["categories"][number]): string | null {
  if (category.imageUrl) return category.imageUrl;
  return category.items[0]?.image_url ?? null;
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
 *
 * Sprint "Cardápio Dark/Premium" (2026-08-09): fundo `zinc-950`, pill
 * inativa `zinc-900`/borda `zinc-700` (visível contra o fundo), pill ativa
 * continua `emerald-500` sólido. Lógica intocada.
 *
 * Etapa 3D — Migração para Tokens (2026-08-12): barra migrou pra
 * `bg-background` (mesmo nível do fundo da página — igual já era a
 * relação original, `zinc-950` na barra = mesma cor do fundo `zinc-950`
 * da raiz), pill inativa virou `bg-surface`/`border-border` (um degrau
 * acima da barra, mesma relação de antes: `zinc-900` era mais claro que
 * `zinc-950`). Pill ativa (verde) preservada sem alteração — cor de ação,
 * fora do escopo. `hover:border-zinc-600` removido sem substituto — não
 * existe token de "borda mais forte" neste conjunto (mesma limitação já
 * registrada em `menu-item-card.tsx`); `hover:text-foreground` mantido.
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
      className="sticky top-0 z-20 flex gap-2 overflow-x-auto border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {categories.map((category) => {
        const imageSrc = resolveCategoryImage(category);
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => handleClick(category.id)}
            aria-current={activeId === category.id ? "true" : undefined}
            className="flex shrink-0 flex-col items-center gap-1.5 active:scale-[0.96]"
          >
            <div
              className={cn(
                "relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 bg-surface transition-colors",
                activeId === category.id ? "border-emerald-500" : "border-border",
              )}
            >
              {imageSrc ? (
                <Image src={imageSrc} alt="" fill sizes="56px" className="object-cover" />
              ) : (
                <span className="text-base font-bold text-muted-foreground">
                  {category.name.trim().charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span
              className={cn(
                "max-w-[64px] truncate text-xs font-medium",
                activeId === category.id ? "text-emerald-600" : "text-muted-foreground",
              )}
            >
              {category.name}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
