"use client";

import { Search, UtensilsCrossed, X } from "lucide-react";

interface RestaurantHeaderProps {
  restaurantName: string;
  tableName?: string;
  /** Opcionais: só o Cardápio (`<CardapioClienteView>`) passa isso — Carrinho, Checkout e Acompanhamento de Pedido continuam sem busca, pois não fazem sentido nessas telas. */
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  /**
   * Identidade — Sprint "Identidade do Restaurante no Cardápio Público"
   * (2026-08-09). `logoUrl` renderizado nas 4 telas públicas (Cardápio,
   * Carrinho, Checkout, Acompanhamento); `description` só passada pelo
   * Cardápio (`menu/page.tsx`) — nas outras 3 o prop simplesmente não é
   * passado, então nada é renderizado, sem precisar de uma flag separada
   * tipo `showDescription`.
   */
  logoUrl?: string | null;
  description?: string | null;
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
 * Sprint "Cardápio Dark/Premium" (2026-08-09): fundo `zinc-950`, campo de
 * busca elevado em `zinc-900` (hierarquia visual: superfície mais clara que
 * o fundo), sem nenhum token do design system antigo nem `ds2-*`.
 * Estrutura/lógica de busca 100% preservadas.
 *
 * Sprint "Identidade do Restaurante no Cardápio Público" (2026-08-09,
 * seguinte): logo (`logoUrl`, com fallback discreto em ícone+nome quando
 * não cadastrada) e descrição (`description`, só renderizada quando existe
 * e não é vazia) — mesmos dados já salvos pelo Perfil do Restaurante
 * (Configurações), nenhum campo/upload novo. `restaurantName` já vem
 * calculado pelo chamador (`getRestaurantDisplayName`, prioriza nome
 * fantasia sobre o nome de cadastro) — este componente só exibe o que
 * recebe, sem decidir qual nome usar.
 *
 * Sprint "Identidade Visual — Logo com Proporção Livre" (2026-08-09,
 * seguinte): quando existe logo, ela vira o elemento principal — altura
 * fixa (100px), largura livre (`w-auto`, respeitando a proporção real do
 * arquivo), `object-contain` (nunca corta nem deforma), **centralizada**
 * sozinha na primeira linha do cabeçalho. O nome em texto SOME (a logo já
 * comunica a identidade sozinha). Sem logo, cai no layout anterior (ícone
 * + nome, alinhado à esquerda, badge "Mesa X" na mesma linha), inalterado.
 *
 * "Mesa X" (2026-08-09, mesmo dia — ajuste de posição): com logo, o badge
 * deixou de dividir linha com ela (estavam competindo pelo mesmo espaço
 * visual) — desce para a linha seguinte, na mesma altura da descrição,
 * mantendo o alinhamento à direita. Sem descrição cadastrada, o badge
 * ainda desce sozinho para essa segunda linha (não volta a competir com a
 * logo). Sem logo, o badge permanece onde sempre esteve, ao lado do nome.
 *
 * `<img>` nativo em vez de `next/image` aqui de propósito: a logo pode ter
 * qualquer proporção, e `next/image` exige `width`/`height` (ou `fill`,
 * que por sua vez exige um contêiner com largura já definida) — nenhum dos
 * dois é conhecido de antemão para um arquivo de proporção livre.
 * `alt={restaurantName}` garante que o nome do restaurante continue
 * acessível a leitor de tela mesmo sem o texto visível.
 */
export function RestaurantHeader({
  restaurantName,
  tableName,
  searchTerm,
  onSearchChange,
  logoUrl,
  description,
}: RestaurantHeaderProps) {
  const hasSearch = onSearchChange !== undefined;
  const hasDescription = Boolean(description?.trim());

  return (
    <header className="flex flex-col gap-3 border-b border-zinc-800 bg-zinc-950/95 px-4 pb-3.5 pt-4 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/80">
      {logoUrl ? (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- proporção livre, ver docstring acima. */}
          <img src={logoUrl} alt={restaurantName} className="h-[100px] w-auto max-w-full object-contain" />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-zinc-800 ring-1 ring-zinc-700">
              <div className="flex h-full w-full items-center justify-center">
                <UtensilsCrossed className="h-4 w-4 text-zinc-500" aria-hidden />
              </div>
            </div>
            <h1 className="truncate text-xl font-bold tracking-tight text-white">{restaurantName}</h1>
          </div>
          {tableName && (
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
              Mesa {tableName}
            </span>
          )}
        </div>
      )}

      {/* Com logo, "Mesa X" desce para esta linha (mesma altura da
          descrição, lado direito) — deixa de competir com a logo pela
          mesma linha/espaço. Sem logo, o badge já está na linha de cima,
          junto do nome — nada aqui. */}
      {logoUrl && (hasDescription || tableName) && (
        <div className="flex items-center justify-between gap-3">
          {hasDescription ? (
            <p className="line-clamp-2 text-xs text-zinc-400">{description}</p>
          ) : (
            <span aria-hidden />
          )}
          {tableName && (
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
              Mesa {tableName}
            </span>
          )}
        </div>
      )}

      {!logoUrl && hasDescription && <p className="line-clamp-2 text-xs text-zinc-400">{description}</p>}


      {hasSearch && (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            aria-hidden
          />
          <input
            type="search"
            inputMode="search"
            value={searchTerm ?? ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Buscar no cardápio..."
            aria-label="Buscar produtos no cardápio"
            className="w-full rounded-full border border-zinc-700 bg-zinc-900 py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange?.("")}
              aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </header>
  );
}
