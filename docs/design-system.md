# Design System do MesaFlow — conceito "Comanda"

Este documento registra o racional por trás das decisões visuais, para que
qualquer pessoa (ou IA) que trabalhe nas próximas telas entenda o porquê das
escolhas, não só o "o quê". A vitrine viva de todos os componentes fica em
`/design-system` (rota fora do grupo `(admin)`, sem exigir login).

## Conceito

A identidade parte de um objeto que já existe em todo restaurante brasileiro:
**a comanda de papel**. Fundo quente como papel, tinta escura para o texto,
um carimbo âmbar-tijolo como cor de ação, e uma fonte monoespaçada reservada
para dado — número de mesa, número de pedido, preço, horário — como no talão
impresso. O painel administrativo é usado várias horas por dia por quem
trabalha no salão; por isso a paleta é calma e de baixa fadiga, com cor
salva para status e ação, não para decoração.

Deliberadamente evitado: fundo creme + serifada de alto contraste + terracota
(combinação que já ficou clichê em produtos gerados por IA), preto quase puro
com acento neon, e layout estilo jornal com hairlines. O calor do "papel" é
parecido ao primeiro clichê na superfície, mas a diferença está na aplicação:
aqui a paleta nasce do objeto de domínio (a comanda), não de uma fórmula
genérica — e o acento (Ember, um tijolo mais escuro e menos alaranjado que o
terracota-padrão) nunca aparece como fundo de hero, só em ações e marca.

## Cores

| Token (CSS var)          | Papel                          | Hex aprox. |
|---------------------------|--------------------------------|------------|
| `--background` (Paper)    | Fundo da aplicação              | `#FAF7F2`  |
| `--foreground` (Ink)      | Texto principal                 | `#211D1A`  |
| `--surface`                | Fundo de cards/inputs           | `#FFFFFF`  |
| `--primary` (Ember)        | Marca, ações primárias          | `#C13E1F`  |
| `--success` (Sage)         | Status "pronto"/disponível      | `#3F6B4A`  |
| `--warning` (Amber)        | Status "preparando"/atenção     | `#8A6508`  |
| `--destructive` (Rust)     | Exclusão, cancelamento          | `#7A2626`  |
| `--info`                   | Informativo neutro (toasts)     | `#2B5A75`  |
| `--muted` / `--border`     | Superfícies e linhas neutras     | tons de `#E7E1D7` |

Todas as cores vivem como CSS vars em `src/app/globals.css` e são expostas ao
Tailwind via `tailwind.config.ts`. **Nunca** usar hex solto num componente —
sempre a classe utilitária (`bg-primary`, `text-destructive`, etc.).

## Tipografia

Três papéis, cada um com uma fonte:

- **Display — Fraunces**: títulos (`font-display`). Serifada editorial com
  personalidade, usada com moderação (H1/H2 e o logotipo), nunca em texto
  corrido.
- **Sans — Inter** (`font-sans`, padrão do `<body>`): toda a interface —
  labels, parágrafos, botões, navegação.
- **Mono — IBM Plex Mono** (`font-mono`): reservada para **dado**, nunca
  para prosa — número de mesa, número de pedido, preço, timestamp. Reforça a
  metáfora do talão impresso e melhora o alinhamento de colunas numéricas em
  tabelas.

## Espaçamento

Escala padrão do Tailwind (base 4px), sem token custom além do necessário —
consistência vem de usar sempre a escala, não de reinventá-la. Únicas
extensões: `18` (4.5rem) e `22` (5.5rem), usadas em shells de layout
(altura de header, etc.).

## Elemento de assinatura: `ticket-edge`

A "borda rasgada de comanda" (classe utilitária `.ticket-edge`, componente
`<CardTicketDivider />`) é o único elemento decorativo deliberadamente
memorável do sistema. Uso **restrito** a divisores dentro de cards que
representem de fato um pedido/comanda (ex.: separar itens do total no card
de pedido). Nunca usar como divisor genérico de seção — perderia o
significado e viraria só decoração.

## Acessibilidade — padrão em todo componente

- Foco visível consistente (`:focus-visible` com anel `ring-2 ring-ring`) —
  nunca `outline: none` sem substituto.
- Modal e ConfirmDialog usam `<dialog>` nativo: foco preso automaticamente,
  Esc fecha, sem reimplementar isso à mão.
- Checkbox/Switch usam `<input>` nativo escondido visualmente (não
  `display: none`), preservando navegação por teclado e leitor de tela.
- Select usa `<select>` nativo estilizado, não um combobox custom — teclado
  e leitor de tela funcionam de graça em todo navegador.
- Toasts usam `role="status"`/`aria-live="polite"`.
- `prefers-reduced-motion` respeitado globalmente (`globals.css`).

## Inventário de componentes (`src/components/ui`)

| Componente | Arquivo |
|---|---|
| Button (+ `buttonVariants()`, +`ButtonLink` para navegação) | `button.tsx`, `button-link.tsx` |
| Input | `input.tsx` |
| Textarea | `textarea.tsx` |
| Select | `select.tsx` |
| Checkbox | `checkbox.tsx` |
| Switch | `switch.tsx` |
| Badge / OrderStatusBadge / TableStatusBadge | `badge.tsx` |
| Card (+ CardTicketDivider) | `card.tsx` |
| Table (+ Head/Body/Row/Cell) | `table.tsx` |
| Modal | `modal.tsx` |
| ConfirmDialog | `confirm-dialog.tsx` |
| Toast (+ Toaster, montado no root layout) | `toast.tsx` |
| Skeleton (+ variantes) | `skeleton.tsx` |
| Spinner / PageLoading | `spinner.tsx` |
| EmptyState | `empty-state.tsx` |
| Pagination | `pagination.tsx` |
| Label + FormField | `label.tsx`, `form-field.tsx` |

Layout: `AdminSidebar` e `AdminHeader` (`src/components/layout`), responsivos
via `AdminShellProvider` (drawer mobile).

## Regra para os próximos módulos

Toda tela nova do painel administrativo ou da Área do Cliente deve ser
composta **a partir destes componentes** — não criar `<button>`/`<input>`
soltos nem duplicar estilos. Se um caso de uso não for coberto por nenhum
componente existente, a extensão do design system acontece aqui primeiro,
antes de ser usada numa tela de negócio.
