"use client";

import { Search, UtensilsCrossed, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
  /**
   * Operação — Fase 4B.2 (2026-08-10). `true`/`false` = mostra o badge
   * "Aberto agora"/"Fechado"; `null`/`undefined` = não mostra nada (sem
   * horário configurado, ou dado inconsistente — `getRestaurantOpenStatus`,
   * `lib/orders/resolve-public-context.ts`, decide isso, nunca este
   * componente). Só passado pelo Cardápio (`menu/page.tsx`) — nas outras 3
   * telas públicas o prop nem é passado, então nada aparece, sem precisar
   * de uma flag separada.
   */
  isOpenNow?: boolean | null;
}

/**
 * Cabeçalho do cardápio do cliente (Fase 3, item 2: "Exibição das
 * informações do restaurante").
 *
 * Sprint "Redesign Premium do Cardápio" (2026-07-28): ganhou uma busca
 * elegante integrada (filtra os produtos já carregados por nome/descrição —
 * estado local em `<CardapioClienteView>`, nenhuma chamada nova de API).
 *
 * Fase 4B.2 — Horário + Timezone (2026-08-10): o indicador "Aberto
 * agora"/"Fechado", cogitado e deliberadamente adiado em Sprints
 * anteriores (`Restaurant` não tinha campo de horário real, só `status` de
 * onboarding), agora existe de verdade — `isOpenNow`, calculado por
 * `getRestaurantOpenStatus()` a partir do horário configurado pelo dono e
 * do timezone real do restaurante, nunca inventado.
 *
 * Sprint "Cardápio Dark/Premium" (2026-08-09): fundo `zinc-950`, campo de
 * busca elevado em `zinc-900` (hierarquia visual: superfície mais clara que
 * o fundo), sem nenhum token do design system antigo nem `ds2-*`.
 * Estrutura/lógica de busca 100% preservadas.
 *
 * Sprint "Identidade Forko — Cardápio Claro" (2026-08-11): fundo virou
 * claro (`zinc-950` → `white`/`zinc-50`, mesma hierarquia de antes, só
 * invertida) — decisão deliberada de manter o Cardápio Público com a
 * identidade do RESTAURANTE (logo do cliente, cor de ação verde), não a
 * do Forko (vermelho) — o cliente final do restaurante não interage com a
 * marca da plataforma, só com a do estabelecimento. Verde continua sendo
 * a cor de ação em todo o Cardápio, intocado.
 *
 * Etapa 3B — Migração para Tokens (2026-08-12): fundo/borda/texto
 * migraram de classe literal para token semântico (`bg-surface`,
 * `border-border`, `text-foreground`, `text-muted-foreground`) — responde
 * a `menu-dark`/`:root` de verdade agora. Verde/vermelho (badge "Mesa X",
 * badge "Aberto agora"/"Fechado", foco do campo de busca) foram
 * deliberadamente PRESERVADOS sem alteração — não são cor estrutural, são
 * cor de ação/estado, fora do escopo desta etapa.
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
 * fixa (75px), largura livre (`w-auto`, respeitando a proporção real do
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
  isOpenNow,
}: RestaurantHeaderProps) {
  const hasSearch = onSearchChange !== undefined;
  const hasDescription = Boolean(description?.trim());

  return (
    <header className="flex flex-col gap-3 border-b border-border bg-surface/95 px-4 pb-3.5 pt-4 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      {logoUrl ? (
        <div className="flex justify-center">
          {/* Dimensionamento estável sem depender de JS/onLoad:
              a largura máxima limita logos horizontais, enquanto logos
              compactas conseguem crescer mais em altura mantendo a
              proporção natural. Sem corte e sem deformação. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- proporção livre, ver docstring acima. */}
          <img
            src={logoUrl}
            alt={restaurantName}
            className="h-auto max-h-32 w-auto max-w-48 object-contain"
          />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border">
              <div className="flex h-full w-full items-center justify-center">
                <UtensilsCrossed className="h-4 w-4 text-muted-foreground" aria-hidden />
              </div>
            </div>
            <h1 className="truncate text-xl font-bold tracking-tight text-foreground">{restaurantName}</h1>
          </div>
          {tableName && (
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
              {tableName.trim().toLowerCase().startsWith("mesa ") ? tableName : `Mesa ${tableName}`}
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
            <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p>
          ) : (
            <span aria-hidden />
          )}
          {tableName && (
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
              {tableName.trim().toLowerCase().startsWith("mesa ") ? tableName : `Mesa ${tableName}`}
            </span>
          )}
        </div>
      )}

      {!logoUrl && hasDescription && <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p>}

      {/* Fase 4B.2 — só o Cardápio passa `isOpenNow` (menu/page.tsx);
          Carrinho/Checkout/Acompanhamento simplesmente não passam essa
          prop, então este bloco nunca renderiza nessas 3 telas. */}
      {(isOpenNow === true || isOpenNow === false) && (
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn("h-1.5 w-1.5 rounded-full", isOpenNow ? "bg-emerald-400" : "bg-red-400")}
          />
          <span className={cn("text-xs font-semibold", isOpenNow ? "text-emerald-400" : "text-red-400")}>
            {isOpenNow ? "Aberto agora" : "Fechado"}
          </span>
        </div>
      )}


      {hasSearch && (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            inputMode="search"
            value={searchTerm ?? ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Buscar no cardápio..."
            aria-label="Buscar produtos no cardápio"
            className="w-full rounded-full border border-border bg-surface py-2.5 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange?.("")}
              aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </header>
  );
}
