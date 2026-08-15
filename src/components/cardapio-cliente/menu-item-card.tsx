import { useState } from "react";
import Image from "next/image";
import { Check, ImageOff, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { PublicMenuItem } from "@/lib/orders/public-menu";

interface MenuItemCardProps {
  item: PublicMenuItem;
  onSelect: (item: PublicMenuItem) => void;
  /**
   * Sistema de Opcionais, Fase 3 — meio a meio, Opção C (2026-08-15).
   * Numa categoria "aceita meio a meio", tocar no card não abre mais o
   * modal direto — seleciona o sabor (destaque visual aqui). Ausente/
   * `false` em toda categoria comum: nenhuma mudança de comportamento.
   */
  selected?: boolean;
}

/**
 * Card de produto (Fase 3, item 4/5: listagem e organização visual dos
 * produtos). Card horizontal: foto quadrada grande à esquerda,
 * nome/descrição/preço à direita, botão "+" ao lado do preço — padrão dos
 * grandes apps de delivery.
 *
 * Sprint de manutenção (2026-08-08): `onError`/fallback na imagem — sem
 * isso, uma imagem que falha ao carregar ficava com `opacity-0` para
 * sempre em vez de cair no placeholder `ImageOff`.
 *
 * Sprint "Cardápio Dark/Premium" (2026-08-09): card `zinc-900` sobre fundo
 * `zinc-950`, borda `zinc-800`, preço em `emerald-400` (mais claro que
 * `emerald-600` para manter contraste em fundo escuro), botão "+" continua
 * `emerald-500` sólido. Nenhuma lógica de seleção foi tocada.
 *
 * Sprint "Identidade Forko — Cardápio Claro" (2026-08-11): card branco
 * sobre fundo `zinc-50`, borda `zinc-200`. Preço voltou para `emerald-600`
 * — o `emerald-400` do tema escuro (claro demais, tuned pra fundo preto)
 * fica com contraste ruim em fundo branco; mesmo raciocínio inverso já
 * usado quando o Cardápio foi de claro pra escuro (o preço trocou de
 * `emerald-600` pra `emerald-400` naquela ocasião, pelo motivo oposto).
 * Verde continua sendo a cor de ação em todo o Cardápio — só o tom exato
 * mudou por legibilidade, não a cor em si.
 *
 * Etapa 3B — Migração para Tokens (2026-08-12): card/borda/textos
 * migraram para token semântico (`bg-surface`, `border-border`,
 * `bg-muted`, `text-foreground`, `text-muted-foreground`, `bg-background`
 * no scrim de indisponível). Dois pontos deliberadamente preservados sem
 * token, fora do escopo desta etapa:
 * (1) preço (`emerald-600`) e botão "+" (`emerald-500`) — cor de ação,
 * instrução explícita pra não alterar; vale registrar que `emerald-600`
 * pode ficar com contraste mais fraco se o tema escuro voltar a ser usado
 * de verdade (foi calibrado pro fundo branco) — não corrigido agora, só
 * uma pendência conhecida pra uma etapa futura, se necessário;
 * (2) badge "Indisponível" (`bg-zinc-900/90 text-white`) — fica sobre a
 * FOTO do produto, não sobre o fundo da página; precisa de contraste alto
 * fixo contra fotos arbitrárias, então não é um candidato correto pra
 * token de tema (mesmo raciocínio já usado no botão de fechar do modal de
 * produto, em outra Sprint). `hover:border-border` no card não escurece
 * mais no hover como `hover:border-zinc-300` fazia — não existe um token
 * de "borda mais forte" neste conjunto (`:root`/`.menu-dark`); efeito
 * hover minimamente reduzido, sem alterar a aparência de forma
 * perceptível fora desse detalhe.
 *
 * Etapa 3C — Elevação do Card (2026-08-12): `shadow-sm`/`hover:shadow-md`
 * (fixos, mesmo peso nos dois temas) trocados por `.elevation-card`
 * (`globals.css`) — classe já existente, pronta desde a Sprint "Redesign
 * Completo do Cardápio Público", nunca antes conectada a nenhum
 * componente. Ela já resolve os dois temas sozinha, sem condicional:
 * sombra + realce de 1px no topo da borda, calibrados both em `:root`
 * (sutil) e `.menu-dark` (mais forte, porque sombra soma pouco sobre um
 * fundo já escuro — o realce claro no topo é quem faz a "espessura"
 * aparecer ali). `transition-all duration-300` removido do card — competia
 * com a transição própria de `.elevation-card` (150ms, já cobre
 * `box-shadow`/`transform`/`border-color`, os únicos 3 que este card
 * anima); manter os dois gerava duas declarações de `transition`
 * concorrendo. `hover:border-border` (já era um no-op — mesmo valor da
 * borda base, nota da Etapa 3B acima) removido junto, por ser redundante.
 * `active:shadow-sm` virou `active:shadow-card` (mesmo espírito: "achatar"
 * a sombra ao pressionar, agora com o valor calibrado por tema em vez de
 * um fixo). Nenhum token novo criado, `globals.css` não foi tocado — só
 * conectei uma classe que já existia.
 *
 * Etapa 3D — Reforço de Contraste (2026-08-12): resultado da 3C ficou
 * discreto demais em fundo claro — a distância de luminosidade entre
 * `--background`/`--surface` em `:root` é pequena (97%/100%, só 3 pontos),
 * bem menor que a do painel administrativo (Mesas, `ds2-*`, 10 pontos).
 * Sem editar `globals.css` (esses tokens também governam onboarding/login
 * — mudança maior que o escopo desta etapa), o reforço possível aqui é
 * `border` → `border-2`, dobrando o peso da borda pra compensar a
 * distância pequena de tom. Ajuda bastante mas não empata 100% com o nível
 * de contraste do Mesas — se ainda não for suficiente, o ajuste correto é
 * nos valores de `:root`/`.menu-dark`, fora do escopo desta etapa.
 */
export function MenuItemCard({ item, onSelect, selected }: MenuItemCardProps) {
  const isAvailable = item.is_available;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const showImage = Boolean(item.image_url) && !hasError;

  return (
    <button
      type="button"
      disabled={!isAvailable}
      onClick={() => onSelect(item)}
      aria-label={isAvailable ? `Ver detalhes de ${item.name}` : `${item.name} — indisponível no momento`}
      className={cn(
        "group flex w-full items-stretch gap-4 rounded-2xl border border-border bg-surface p-3.5 text-left elevation-card",
        selected && "border-emerald-500 ring-1 ring-emerald-500",
        isAvailable
          ? "hover:-translate-y-1 active:translate-y-0 active:scale-[0.99] active:shadow-card"
          : "cursor-not-allowed opacity-60",
      )}
    >
      <div className="relative h-36 w-36 shrink-0 overflow-hidden rounded-2xl bg-muted">
        {showImage ? (
          <>
            {!imageLoaded && <div className="absolute inset-0 z-10 animate-pulse bg-muted" aria-hidden />}
            <Image
              src={item.image_url as string}
              alt=""
              fill
              sizes="144px"
              onLoad={() => setImageLoaded(true)}
              onError={() => setHasError(true)}
              className={cn(
                "object-cover transition-transform duration-500 ease-out",
                isAvailable && "group-hover:scale-[1.06]",
                imageLoaded ? "opacity-100" : "opacity-0",
              )}
            />
          </>
        ) : (
          // Placeholder discreto: cinza liso e um ícone pequeno, sem
          // círculo/sombra própria — não deve competir com fotos reais nem
          // parecer um erro.
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <ImageOff className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} aria-hidden />
          </div>
        )}

        {/* Sistema de Opcionais, Fase 3 — meio a meio, Opção C (2026-08-15):
            selo de "escolhido" sobre a foto, mesma linguagem visual do
            mockup aprovado — só aparece em categoria de meio a meio. */}
        {selected && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/30">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
              <Check className="h-5 w-5" strokeWidth={3} />
            </span>
          </div>
        )}

        {!isAvailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
            <span className="rounded-full bg-zinc-900/90 px-2.5 py-1 text-xs font-semibold text-white">
              Indisponível
            </span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-1">
        <p className="line-clamp-1 text-lg font-bold leading-tight tracking-tight text-foreground">{item.name}</p>
        {item.description && (
          <p className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">{item.description}</p>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-lg font-extrabold tabular-nums tracking-tight text-soft-success-foreground">
            {formatCurrency(item.price)}
          </span>

          {isAvailable && (
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/30 transition-transform duration-200 ease-out group-hover:scale-110 group-active:scale-90"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
