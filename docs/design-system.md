# Design System do MesaFlow — v2

Este documento registra o racional por trás das decisões visuais, para que
qualquer pessoa (ou IA) que trabalhe nas próximas telas entenda o porquê das
escolhas, não só o "o quê". A vitrine viva de todos os componentes fica em
`/design-system` (rota fora do grupo `(admin)`, sem exigir login).

## Conceito

Paleta neutra fria (grafite/branco), com um acento indigo-violeta como cor
de marca e ação. A navegação estrutural do painel administrativo (sidebar)
usa um "chrome" escuro dedicado — separado do conteúdo claro — para dar peso
e assinatura visual sem escurecer telas de trabalho usadas por horas. Dado
numérico (mesa, pedido, preço, horário) continua reservado a uma fonte
monoespaçada em todo o produto, admin e Área do Cliente.

## Cores

| Token (CSS var)          | Papel                          |
|---------------------------|--------------------------------|
| `--background`             | Fundo da aplicação (conteúdo)   |
| `--foreground`             | Texto principal                 |
| `--surface`                | Fundo de cards/inputs           |
| `--primary` (Indigo)       | Marca, ações primárias          |
| `--success`                | Status "pronto"/disponível      |
| `--warning`                | Status "preparando"/atenção     |
| `--destructive`            | Exclusão, cancelamento          |
| `--info`                   | Informativo neutro (toasts)     |
| `--muted` / `--border`     | Superfícies e linhas neutras     |
| `--chrome*`                | Sidebar escura do admin (só navegação estrutural, nunca conteúdo) |

Todas as cores vivem como CSS vars em `src/app/globals.css` e são expostas ao
Tailwind via `tailwind.config.ts`. **Nunca** usar hex solto num componente —
sempre a classe utilitária (`bg-primary`, `text-destructive`, etc.).

## Tipografia

Três papéis, cada um com uma fonte:

- **Display — Manrope** (`font-display`): títulos e a marca. Geométrica, peso
  firme, sem serifa — usada com moderação (H1/H2 e o logotipo), nunca em
  texto corrido.
- **Sans — Inter** (`font-sans`, padrão do `<body>`): toda a interface —
  labels, parágrafos, botões, navegação.
- **Mono — IBM Plex Mono** (`font-mono`): reservada para **dado**, nunca
  para prosa — número de mesa, número de pedido, preço, timestamp. Melhora
  o alinhamento de colunas numéricas em tabelas.

## Espaçamento e raio

Escala padrão do Tailwind (base 4px). Únicas extensões: `18` (4.5rem) e `22`
(5.5rem), usadas em shells de layout (altura de header, etc.). Raio de borda
(`--radius`) mais generoso que a v1 — cantos mais suaves em cards, botões e
modais, consistente em toda a interface via `rounded-lg`/`md`/`sm`.

## Elevação

`shadow-card` / `shadow-card-hover` para elevação neutra de cards e
`shadow-glow` (sombra tingida com `--primary`) reservada à ação primária
(`Button variant="primary"`, marca na sidebar) — nunca usada em elementos
neutros, para manter o efeito como assinatura de "ação principal".

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
| Card (+ CardDivider) | `card.tsx` |
| Alert | `alert.tsx` |
| Table (+ Head/Body/Row/Cell) | `table.tsx` |
| Modal | `modal.tsx` |
| ConfirmDialog | `confirm-dialog.tsx` |
| Toast (+ Toaster, montado no root layout) | `toast.tsx` |
| Skeleton (+ variantes) | `skeleton.tsx` |
| Spinner / PageLoading | `spinner.tsx` |
| EmptyState | `empty-state.tsx` |
| Pagination | `pagination.tsx` |
| Label + FormField | `label.tsx`, `form-field.tsx` |

Layout: `AdminSidebar` (chrome escuro) e `AdminHeader` (`src/components/layout`),
responsivos via `AdminShellProvider` (drawer mobile).

## Regra para os próximos módulos

Toda tela nova do painel administrativo ou da Área do Cliente deve ser
composta **a partir destes componentes** — não criar `<button>`/`<input>`
soltos nem duplicar estilos. Se um caso de uso não for coberto por nenhum
componente existente, a extensão do design system acontece aqui primeiro,
antes de ser usada numa tela de negócio.
