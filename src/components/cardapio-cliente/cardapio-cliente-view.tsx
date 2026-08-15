"use client";

import { useMemo, useState } from "react";
import { SearchX, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import { RestaurantHeader } from "@/components/cardapio-cliente/restaurant-header";
import { CategoryNav, categorySectionId } from "@/components/cardapio-cliente/category-nav";
import { MenuItemCard } from "@/components/cardapio-cliente/menu-item-card";
import { MenuItemCardCompact } from "@/components/cardapio-cliente/menu-item-card-compact";
import { ProductDetailModal } from "@/components/cardapio-cliente/product-detail-modal";
import { CartProvider } from "@/components/cardapio-cliente/cart-context";
import { CartSummaryBar } from "@/components/cardapio-cliente/cart-summary-bar";
import { TableAssistanceActions } from "@/components/cardapio-cliente/table-assistance-actions";
import { HalfAndHalfConfirmModal } from "@/components/cardapio-cliente/half-and-half-confirm-modal";
import type { PublicMenuCategory, PublicMenuItem } from "@/lib/orders/public-menu";

interface CardapioClienteViewProps {
  slug: string;
  tableToken: string | null;
  restaurantName: string;
  // Identidade — Sprint "Identidade do Restaurante no Cardápio Público"
  // (2026-08-09). Só passagem até `<RestaurantHeader>`.
  restaurantLogoUrl?: string | null;
  restaurantDescription?: string | null;
  // Operação — Fase 4B.2 (2026-08-10). Só passagem até
  // `<RestaurantHeader>`; não passado por Carrinho/Checkout/Acompanhamento
  // de propósito (o indicador é exclusivo do Cardápio).
  restaurantIsOpen?: boolean | null;
  // Etapa 2 — Propagação do Tema (2026-08-11). Decide, na raiz desta view,
  // se a classe `menu-dark` é aplicada — não em nenhum componente filho.
  // Sem prop (`undefined`) cai no comportamento atual (escuro), mesmo
  // default `'dark'` já usado no banco.
  menuTheme?: "light" | "dark";
  tableName?: string;
  categories: PublicMenuCategory[];
}

/**
 * Tela do cardápio do cliente (Fase 3 completa): cabeçalho com dados do
 * restaurante/mesa (item 2), navegação por categorias (itens 3/6),
 * listagem e organização visual dos produtos (itens 4/5) e o modal de
 * detalhes do produto (item 7). O carrinho (item 8) é só a estrutura —
 * `<CartProvider>` guarda o estado, `<CartSummaryBar>` reflete o total,
 * mas a tela de carrinho/finalização em si chega na Fase 4.
 *
 * Busca do cabeçalho filtra `categories` inteiramente no cliente (nome +
 * descrição, sem acento/caixa) — é estado local deste componente, nenhuma
 * chamada nova de API, hook compartilhado, contexto global ou tipagem
 * alterada. Categorias sem nenhum resultado após o filtro somem da tela;
 * a barra de categorias usa sempre a lista completa (não teria sentido
 * "pular" para uma categoria que a busca escondeu).
 *
 * Sprint de reconstrução visual (2026-08-08): reescrito para usar só
 * paleta padrão do Tailwind (fundo `zinc-50`, cards brancos, texto
 * `zinc-900`), sem nenhum token do design system antigo nem `ds2-*`.
 * Busca, categorias, listagem e todo o resto da estrutura/lógica
 * continuam exatamente iguais — só `className` mudou.
 *
 * Sprint de autossuficiência visual (2026-08-08, seguinte): os dois
 * estados vazios deixaram de depender de `<EmptyState>` (estava
 * renderizando sem nenhum estilo visível em produção, confirmado por
 * captura de tela real) — agora são HTML nativo com classes Tailwind
 * diretas.
 *
 * Sprint "Cardápio Dark/Premium" (2026-08-09): fundo `zinc-950` contínuo
 * (`min-h-dvh`, sem faixa/bloco extra — nenhum elemento deste arquivo tem
 * fundo preto próprio além do fundo geral da página).
 *
 * Etapa 3A — Prova de Conceito do Tema (2026-08-12): a ESTRUTURA PRINCIPAL
 * deste arquivo (raiz + os 2 estados vazios + título de categoria) migrou
 * de classe literal (`bg-zinc-950`, `text-white`, etc.) para token
 * semântico (`bg-background`, `text-foreground`, etc.) — responde de
 * verdade a `menu-dark`/`:root` agora. `--foreground-subtle` foi
 * deliberadamente evitado (existe só em `.menu-dark`, ausente em `:root`
 * — usá-lo quebraria o tema claro); `text-muted-foreground` cobre o mesmo
 * papel e existe nos dois. Os componentes internos
 * (`RestaurantHeader`/`MenuItemCard`/`ProductDetailModal`/`CategoryNav`/
 * `CartSummaryBar`/`TableAssistanceActions`) continuam com classe literal
 * — intocados de propósito, escopo de uma etapa futura.
 *
 * RISCO AINDA NÃO RESOLVIDO: `<TableAssistanceActions>` ("Chamar
 * garçom"/"Pedir a conta") é importado aqui mas eu nunca recebi o
 * código-fonte dele — não posso corrigir a aparência desses dois botões
 * nem confirmar que já estão no dark theme.
 */
export function CardapioClienteView({
  slug,
  tableToken,
  restaurantName,
  restaurantLogoUrl,
  restaurantDescription,
  restaurantIsOpen,
  menuTheme,
  tableName,
  categories,
}: CardapioClienteViewProps) {
  const [selectedItem, setSelectedItem] = useState<PublicMenuItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const hasCategories = categories.length > 0;

  // Sistema de Opcionais, Fase 3 — meio a meio, Opção C (2026-08-15):
  // seleção acontece nos CARDS da lista, não dentro de um modal — só numa
  // categoria marcada `allowsHalfAndHalf`. `halfAndHalfCategoryId`
  // amarra a seleção a UMA categoria por vez (tocar num card de outra
  // categoria de meio a meio no meio do caminho reinicia, não mistura
  // sabores de categorias diferentes). `halfAndHalfSelection` guarda até
  // 2 ids — pode repetir o mesmo id 2x (pizza inteira daquele sabor).
  const [halfAndHalfCategoryId, setHalfAndHalfCategoryId] = useState<string | null>(null);
  const [halfAndHalfSelection, setHalfAndHalfSelection] = useState<string[]>([]);
  const [halfAndHalfConfirmOpen, setHalfAndHalfConfirmOpen] = useState(false);

  /**
   * Decide o que um toque num card significa: categoria comum abre o
   * modal de sempre; categoria "aceita meio a meio" seleciona/desfaz.
   *
   * Regra de desfazer erro de toque (pedido explícito do dono, depois de
   * testar o mockup): com os 2 sabores já escolhidos (barra de revisão
   * visível), tocar de novo num dos dois JÁ escolhidos remove ele — dá
   * pra corrigir um toque errado sem reiniciar tudo. Só com 1 sabor
   * escolhido, tocar nele de novo forma o par com ele mesmo (pizza
   * inteira daquele sabor) — não desfaz; a correção de erro só faz
   * sentido depois que os 2 já estão visíveis na barra de revisão.
   */
  function handleCardTap(item: PublicMenuItem, category: PublicMenuCategory) {
    if (!category.allowsHalfAndHalf) {
      setSelectedItem(item);
      return;
    }

    if (halfAndHalfCategoryId !== category.id) {
      setHalfAndHalfCategoryId(category.id);
      setHalfAndHalfSelection([item.id]);
      return;
    }

    setHalfAndHalfSelection((prev) => {
      if (prev.length === 0) return [item.id];
      if (prev.length === 1) {
        // `noUncheckedIndexedAccess` (tsconfig) tipa `prev[0]` como
        // `string | undefined`, mesmo já sabendo (via `.length === 1`)
        // que a posição existe — guard explícito em vez de non-null
        // assertion, mesmo padrão já usado em `cart-context.tsx`.
        const firstFlavorId = prev[0];
        if (!firstFlavorId) return prev;
        return [firstFlavorId, item.id];
      }
      // 2 já escolhidos (revisão): tocar num deles remove ele; tocar num
      // 3º sabor diferente não faz nada — precisa desfazer um antes.
      if (prev.includes(item.id)) {
        const idx = prev.indexOf(item.id);
        return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
      }
      return prev;
    });
  }

  function closeHalfAndHalfConfirm() {
    setHalfAndHalfConfirmOpen(false);
    setHalfAndHalfCategoryId(null);
    setHalfAndHalfSelection([]);
  }

  /**
   * Repensado (2026-08-15): a 1ª versão só dizia "selecionado ou não"
   * (check genérico) — o dono relatou confusão testando: tocar 2x no
   * mesmo sabor "parecia bugado", sem nada diferenciando "marquei a 1ª
   * metade" de "marquei a 2ª". Agora devolve a posição exata: `1`/`2`
   * conforme o índice em `halfAndHalfSelection`, ou `"both"` quando o
   * mesmo sabor ocupa as duas posições (pizza inteira).
   */
  function getSelectedSlot(item: PublicMenuItem, category: PublicMenuCategory): 1 | 2 | "both" | null {
    if (halfAndHalfCategoryId !== category.id) return null;
    const isFirst = halfAndHalfSelection[0] === item.id;
    const isSecond = halfAndHalfSelection.length > 1 && halfAndHalfSelection[1] === item.id;
    if (isFirst && isSecond) return "both";
    if (isFirst) return 1;
    if (isSecond) return 2;
    return null;
  }

  const halfAndHalfCategory = categories.find((c) => c.id === halfAndHalfCategoryId);
  const halfAndHalfFlavors = halfAndHalfSelection
    .map((id) => halfAndHalfCategory?.items.find((i) => i.id === id))
    .filter((flavor): flavor is PublicMenuItem => flavor !== undefined);
  const isHalfAndHalfReviewing = halfAndHalfFlavors.length === 2 && !halfAndHalfConfirmOpen;
  // `noUncheckedIndexedAccess` (tsconfig) tipa `halfAndHalfFlavors[0]`/`[1]`
  // como possivelmente `undefined`, mesmo já sabendo (via `.length`) que a
  // posição existe — guard explícito uma vez aqui, reaproveitado no JSX
  // abaixo, em vez de repetir non-null assertion em cada uso.
  const firstFlavor = halfAndHalfFlavors[0];
  const secondFlavor = halfAndHalfFlavors[1];

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase("pt-BR");

  const visibleCategories = useMemo(() => {
    if (!normalizedSearch) return categories;

    return categories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => {
          const haystack = `${item.name} ${item.description ?? ""}`.toLocaleLowerCase("pt-BR");
          return haystack.includes(normalizedSearch);
        }),
      }))
      .filter((category) => category.items.length > 0);
  }, [categories, normalizedSearch]);

  const hasResults = visibleCategories.length > 0;

  return (
    <CartProvider slug={slug} tableToken={tableToken}>
      <div
        className={cn(
          "mx-auto flex min-h-dvh max-w-xl flex-col bg-background pb-24 sm:border-x sm:border-border sm:shadow-sm",
          menuTheme === "dark" && "menu-dark",
        )}
      >
        <RestaurantHeader
          restaurantName={restaurantName}
          logoUrl={restaurantLogoUrl}
          description={restaurantDescription}
          isOpenNow={restaurantIsOpen}
          tableName={tableName}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
        <TableAssistanceActions slug={slug} tableToken={tableToken} />
        <CategoryNav categories={categories} />

        <main className="flex flex-1 flex-col gap-7 px-4 py-5">
          {/* Sistema de Opcionais, Fase 3 — meio a meio, Opção C
              (2026-08-15). Só aparece com exatamente 1 sabor escolhido —
              com 2, a barra de revisão fixa (mais abaixo) já assume esse
              papel. */}
          {halfAndHalfFlavors.length === 1 && firstFlavor && (
            <div className="rounded-xl bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300">
              <span className="font-semibold">{firstFlavor.name}</span> selecionada — toque em outro
              sabor (ou nela de novo, pra pizza inteira).
            </div>
          )}

          {!hasCategories ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface px-6 py-14 text-center elevation-card">
              <UtensilsCrossed className="h-10 w-10 text-muted-foreground" aria-hidden />
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-foreground">Cardápio ainda não disponível</p>
                <p className="text-sm text-muted-foreground">Este restaurante ainda não cadastrou categorias ou produtos.</p>
              </div>
            </div>
          ) : !hasResults ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface px-6 py-14 text-center elevation-card">
              <SearchX className="h-10 w-10 text-muted-foreground" aria-hidden />
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-foreground">Nenhum produto encontrado</p>
                <p className="text-sm text-muted-foreground">
                  Não encontramos nada para &quot;{searchTerm.trim()}&quot;. Tente buscar por outro termo.
                </p>
              </div>
            </div>
          ) : (
            visibleCategories.map((category) => (
              <section
                key={category.id}
                id={categorySectionId(category.id)}
                className="flex scroll-mt-16 flex-col gap-3"
              >
                <h2 className="text-base font-bold tracking-tight text-foreground">{category.name}</h2>

                {/* Layout compacto por categoria (2026-08-15) — mockup
                    aprovado antes de codar. Só muda a apresentação (grade
                    2 colunas, card menor); a lógica de seleção (toque
                    normal ou meio a meio) é exatamente a mesma dos dois
                    lados, `handleCardTap`/`getSelectedSlot` não sabem
                    nem precisam saber qual card renderizou o toque. */}
                {category.isCompact ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    {category.items.map((item) => (
                      <MenuItemCardCompact
                        key={item.id}
                        item={item}
                        onSelect={() => handleCardTap(item, category)}
                        selectedSlot={getSelectedSlot(item, category)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3.5">
                    {category.items.map((item) => (
                      <MenuItemCard
                        key={item.id}
                        item={item}
                        onSelect={() => handleCardTap(item, category)}
                        selectedSlot={getSelectedSlot(item, category)}
                      />
                    ))}
                  </div>
                )}
              </section>
            ))
          )}
        </main>

        <ProductDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />

        {/* Sistema de Opcionais, Fase 3 — meio a meio, Opção C
            (2026-08-15). Aparece só com os 2 sabores escolhidos e ANTES
            do modal final abrir — pedido explícito do dono, pra dar
            chance de corrigir um toque errado (tocar de novo num dos 2
            cards escolhidos desfaz, ver `handleCardTap`) sem já ter
            comprometido nada. Mesma posição/altura do `<CartSummaryBar>`
            de propósito — os dois nunca aparecem ao mesmo tempo. */}
        {isHalfAndHalfReviewing && firstFlavor && secondFlavor && (
          <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-xl border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-border">
              <div className="flex min-w-0 flex-col">
                <span className="text-xs text-muted-foreground">
                  {firstFlavor.id === secondFlavor.id ? "Pizza inteira" : "Meio a meio"}
                </span>
                <span className="truncate text-sm font-semibold text-foreground">
                  {firstFlavor.id === secondFlavor.id ? firstFlavor.name : `${firstFlavor.name} + ${secondFlavor.name}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setHalfAndHalfConfirmOpen(true)}
                className="shrink-0 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 active:scale-[0.98]"
              >
                Confirmar
              </button>
            </div>
          </div>
        )}

        <HalfAndHalfConfirmModal
          flavorA={halfAndHalfConfirmOpen ? (firstFlavor ?? null) : null}
          flavorB={halfAndHalfConfirmOpen ? (secondFlavor ?? null) : null}
          onClose={closeHalfAndHalfConfirm}
        />

        {!isHalfAndHalfReviewing && <CartSummaryBar slug={slug} />}
      </div>
    </CartProvider>
  );
}
