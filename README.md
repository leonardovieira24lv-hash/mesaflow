# MesaFlow

SaaS de pedidos via QR Code para restaurantes. Este documento é a fundação
técnica do projeto: estrutura, convenções e como cada módulo futuro deve se
encaixar. O contrato de API oficial (front-end ↔ back-end) vive em
`api-contracts-v1.md` e é a fonte da verdade para payloads, códigos de erro e
comportamento dos endpoints — este README nunca deve contradizê-lo.

## Estado atual do MVP (pós-Sprint 10)

A v1 do contrato (`api-contracts-v1.md`, seções 2 a 8) está **completa e
auditada**: todos os 26 endpoints da seção 9 (Visão Consolidada) estão
implementados, e a Sprint 10 fechou a última lacuna de front-end que restava
— o Painel de Pedidos administrativo (contrato 8.1/8.2), que tinha o backend
pronto desde a Sprint 8 mas a tela ainda era um placeholder. Nenhum endpoint
da v1 retorna mais `stubResponse(...)`, e não sobrou nenhuma tela do fluxo
principal com "Módulo a implementar".

Módulos concluídos: Autenticação (3), Onboarding (4), Dashboard (5), Cardápio
(6), Mesas e QR Codes (7), Área do Cliente pública + Pedidos administrativos e
Realtime (8), Configurações (9) — números entre parênteses referem-se à
sprint em que o backend ficou pronto; ver "Auditoria de Qualidade (Sprint
10)" para o que precisou de correção na camada de front-end.

Fora do escopo da v1 (ver contrato, seção 10, e a seção de roadmap no fim
deste documento): funcionários/convites, variações de produto, histórico de
status, pagamentos, estoque, fidelidade e relatórios — todos ficam para v1.1
em diante.

## Auditoria de Qualidade (Sprint 10)

Sprint sem novas funcionalidades — v1 e v1.1 continuam com o mesmo escopo já
documentado. Objetivo único: revisar consistência visual, mobile/desktop,
navegação, loading/vazio/erro, componentes duplicados, código morto,
performance, memory leaks, re-renderizações, memoização, acessibilidade e o
Design System, percorrendo a jornada completa (Login → Onboarding →
Dashboard → Cardápio → QR Code → Cliente → Carrinho → Checkout → Pedido →
Painel Administrativo → Finalização).

### Bug crítico encontrado e corrigido: Painel de Pedidos era um placeholder

`(admin)/pedidos/page.tsx` e `(admin)/pedidos/[id]/page.tsx` ainda exibiam
"Módulo a implementar" — apesar do backend completo (contrato 8.1/8.2/8.3,
Sprint 8) e do link "Pedidos" já existir na barra lateral
(`admin-sidebar.tsx`) apontando para eles. Isso quebrava a etapa "Painel
Administrativo" da jornada completa pedida nesta auditoria: um atendente
literalmente não conseguia ver ou avançar o status de nenhum pedido pelo
painel. Não é uma funcionalidade nova da v1.1 — é o fechamento de um módulo
que já constava como "concluído" na documentação da Sprint 8/9, então tratado
aqui como correção de bug, não como novo módulo.

Construído com os mesmos padrões já estabelecidos (Server Component carrega
a página inicial, Client Component cuida da interação — mesmo modelo de
`(admin)/mesas`):

- `components/pedidos/orders-list.tsx`: listagem com abas de filtro por
  status, paginação (`<Pagination>`), skeleton de carregamento
  (`<SkeletonTableRow>`), estado vazio (`<EmptyState>`) e clique na linha
  (mouse + teclado) para abrir o detalhe.
- `components/pedidos/order-detail.tsx`: itens, observações, total (usando
  `<CardTicketDivider>` — ver achado de Design System abaixo) e botões de
  transição de status, calculados dinamicamente a partir da máquina de
  estados do contrato 8.3 (nunca uma lista de botões fixa que poderia
  divergir do backend). Cancelar pede confirmação (`<ConfirmDialog>`); os
  demais avanços aplicam direto, mesmo critério já usado no restante do
  painel para ações destrutivas vs. não-destrutivas.
- `lib/orders/order-status-transitions-map.ts` (novo): a máquina de estados
  de `lib/orders/status-transitions.ts` não podia ser importada por um
  Client Component (depende de `AppError`, que importa `next/server`) — a
  tabela pura foi extraída para este novo arquivo, e `status-transitions.ts`
  passou a importar dali em vez de manter sua própria cópia. Elimina a
  duplicação que existiria se o Painel simplesmente reescrevesse a mesma
  tabela à mão.
- **Realtime de verdade** (não polling): `restaurant:{id}:orders` na lista,
  `orders:id=eq.{id}` no detalhe — via `@supabase/ssr` no browser
  (`lib/supabase/client.ts`) com `postgres_changes`. Diferente da Área do
  Cliente pública (que usa polling por razão de segurança documentada em
  `order-tracking-view.tsx`), aqui é seguro porque a tela só existe atrás de
  `requireSession()` + RLS: o Realtime do Supabase respeita a mesma política
  de RLS de leitura da tabela, então um usuário autenticado só recebe
  eventos dos pedidos do próprio restaurante — exatamente o comportamento
  que o comentário original de `api/v1/orders/route.ts` (Sprint 8) já
  previa, mas nunca tinha sido implementado.

### Outros bugs encontrados e corrigidos

- **Comentário desatualizado em `components/dashboard/recent-orders.tsx`**:
  dizia que a lista "sempre mostra o estado vazio" — verdade na Sprint 5,
  falso desde que a Sprint 8 implementou a criação de pedidos.
  `getRecentOrders` já consultava a tabela `orders` real e não precisou de
  nenhuma mudança de comportamento, só a documentação estava errada.
- **`console.log` de debug em produção**: `api/v1/onboarding/restaurant/route.ts`
  imprimia se `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`/`SERVICE_ROLE_KEY`
  estavam definidas a cada cadastro — pendência já registrada nas Sprints 9
  e 10, removida agora que a sprint tem escopo de auditoria irrestrito.
- **`next.config.mjs`**: `experimental.typedRoutes` renomeado para
  `typedRoutes` (topo do objeto de config) — a chave antiga ainda
  funcionava, mas emitia aviso a cada build nesta versão do Next.
- **Memory leak — timer sem cleanup**: `CheckoutContent` (`checkout-view.tsx`)
  chamava `setTimeout(...)` (1200ms) para limpar o carrinho e redirecionar
  após um pedido, sem limpar esse timer se o componente desmontasse antes
  disso (ex.: cliente fecha a aba logo após o pedido ser aceito). Corrigido
  guardando o id do timer numa ref e limpando no unmount.
- **Bug de acessibilidade latente em `components/ui/modal.tsx`**:
  `aria-labelledby="modal-title"` era fixo, mas a opção `hideHeader` omite
  o `<h2 id="modal-title">` — se algum consumidor futuro usasse
  `hideHeader`, o diálogo ficaria sem nome acessível para leitores de tela.
  Nenhum componente usa `hideHeader` hoje, mas corrigido porque é o tipo de
  bug que só aparece quando alguém finalmente usar a opção.

### Componentes duplicados

Três instâncias idênticas de `new Intl.NumberFormat("pt-BR", { style:
"currency", currency: "BRL" })` — em `lib/format.ts` (a canônica, criada na
Sprint 8 "para a Área do Cliente não abrir uma terceira instância igual",
mas os dois arquivos anteriores foram deliberadamente deixados como estavam
naquele momento), `components/dashboard/recent-orders.tsx` e
`components/cardapio/products-list.tsx`. Consolidado: os dois últimos agora
importam `formatCurrency` de `lib/format.ts` — sem nenhuma mudança de
comportamento, só uma instância a menos rodando em memória por render.

### Performance / re-renderizações / memoização

`components/cardapio-cliente/cart-context.tsx`: o objeto `value` do
`<CartContext.Provider>` e as quatro funções do carrinho
(`addItem`/`updateQuantity`/`removeItem`/`clear`) eram recriados a cada
render do `<CartProvider>`, fazendo todo consumidor de `useCart()`
re-renderizar mesmo quando nada relevante tinha mudado. Corrigido com
`useCallback` nas funções e `useMemo` no objeto de valor — mesmo carrinho,
menos trabalho de render em cascata pela árvore de componentes que o
consome (modal de produto, resumo do carrinho, linha do carrinho, checkout).

### Consistência do Design System

`<CardTicketDivider>` — descrito no próprio código como "o elemento de
assinatura do design system", pensado especificamente para separar itens do
total num card de pedido/comanda — só era usado na página de showcase
(`/design-system`), nunca em nenhuma tela real de pedido (`checkout-view.tsx`,
`carrinho-view.tsx` ou o antigo placeholder de Pedidos). Usado agora em
`<OrderDetail>` (novo). Não alterado em `checkout-view.tsx`/`carrinho-view.tsx`
por serem telas já em produção desde a Fase 4 — fica registrado como melhoria
sugerida abaixo, não como bug, para não alterar uma tela já funcionando fora
do escopo desta auditoria.

### Acessibilidade

- Adicionado `aria-live="polite"` no indicador de quantidade do modal de
  produto (`product-detail-modal.tsx`), para leitores de tela anunciarem a
  mudança ao clicar em +/-.
- Revisados todos os formulários do fluxo principal (login, onboarding,
  cardápio, mesas, configurações, checkout): todos já usam `<FormField>`
  (label associado via `htmlFor`/`id`), `aria-label` em botões só-ícone, e
  `role="alert"` em mensagens de erro de formulário — nenhum problema novo
  encontrado além do já corrigido em `modal.tsx`.

### Navegação, loading, vazio e erro — revisados, sem bugs adicionais

Todas as listagens do painel (Cardápio, Mesas, e agora Pedidos) usam os
mesmos primitivos (`<EmptyState>`, `<Skeleton*>`, toasts de erro com opção
de tentar novamente) — nenhuma tela do fluxo principal ficou sem um desses
três estados. Navegação entre Dashboard → Cardápio/Mesas/Pedidos/Configurações
(sidebar) e a jornada pública completa (menu → carrinho → checkout →
acompanhamento) foram percorridas linha a linha; nenhum link quebrado ou
rota órfã encontrada.

### Melhorias sugeridas antes da publicação do MVP (não implementadas nesta sprint)

Todas abaixo exigiriam tocar telas já em produção fora do escopo desta
auditoria, ou são otimizações sem bug associado — documentadas, não
corrigidas:

1. **Usar `<CardTicketDivider>` em `checkout-view.tsx`/`carrinho-view.tsx`**
   para consistência total do Design System nas outras duas telas que
   também representam uma comanda.
2. **Testes automatizados** (unitários e E2E da jornada completa) — nenhum
   existe hoje; esta sprint validou manualmente + `tsc`/`lint`/`build`, o
   que não substitui uma suíte de regressão de verdade.
3. **`loading.tsx` por rota** nas páginas públicas (`(public)/[slug]/menu`,
   `/checkout`) para um esqueleto de carregamento nativo do App Router
   durante a navegação entre elas, em vez de depender só do Server
   Component terminar de buscar os dados.
4. **Revisar `hideHeader` em `<Modal>`**: hoje não é usado por nenhum
   consumidor — decidir se vira uma opção realmente suportada (com um teste
   de uso real) ou se é removida como código morto numa próxima sprint.
5. **Rate limiting real** em `POST /api/v1/public/{slug}/orders` — o
   contrato já prevê `429 RATE_LIMITED` e o front-end já trata essa
   resposta (`checkout-view.tsx`), mas não foi auditado nesta sprint se o
   backend de fato aplica um limite (fora do escopo de front-end desta
   auditoria).



Uma seção logo abaixo (**"Correção de build para Next.js 14 / React 18"**,
escrita após a Sprint 7) registra uma correção que teria revertido o projeto
para o padrão **síncrono** de `params`/`cookies()` do Next.js 14, e afirma que
a versão 14.2.5 foi fixada "deliberadamente". Isso **nunca refletiu o estado
real do código nem do `package.json`**, que sempre declarou
`"next": "^15.5.21"` — uma contradição identificada na auditoria de fundação
anterior a esta sprint.

Nesta sprint, pela primeira vez, o ambiente teve acesso de rede real para
`npm install`. Isso permitiu confirmar de forma definitiva (`npx tsc --noEmit`,
`npx next lint`, `npx next build`, este último imprimindo
`▲ Next.js 15.5.21` no cabeçalho do build):

- **100% das rotas dinâmicas** (`api/v1/tables/[id]`, `api/v1/orders/[id]`,
  `(admin)/pedidos/[id]`, `(public)/[slug]/menu`, etc. — 16 arquivos ao todo)
  usam o padrão assíncrono `params: Promise<{...}>` com `await params`, que só
  existe a partir do Next.js 15.
- `lib/supabase/server.ts` chama `await cookies()` — também exclusivo do
  Next.js 15 (`cookies()` síncrono não existe nessa API a partir dessa
  versão).
- Não sobrou nenhum resquício do padrão síncrono do Next 14 em lugar nenhum
  do `src/`.

**Conclusão:** a migração para Next.js 15 está de fato completa e é o estado
real e correto do projeto — a seção "Correção de build para Next.js 14 /
React 18" abaixo está **desatualizada/incorreta** e é mantida só como registro
histórico de uma sprint passada; não representa mais a versão-alvo do
projeto. `next.config.mjs` também emite um aviso (não um erro) de que
`experimental.typedRoutes` foi renomeado para `typedRoutes` no topo do objeto
de config nesta versão do Next — ajuste cosmético, não corrigido nesta sprint
por ser fora do escopo de Configurações, registrado aqui para a próxima
manutenção.

## Correção de build para Next.js 14 / React 18 (pós-Sprint 7)

> **Nota (Sprint 9):** a premissa desta seção — de que o projeto foi revertido
> para o padrão síncrono do Next 14 — está incorreta; ver "Versão do Next.js:
> divergência resolvida" logo acima. Mantida abaixo apenas como registro
> histórico do que foi de fato alterado naquela sprint (as correções de tipo
> em si continuam válidas, só a conclusão sobre a versão-alvo não).

Após o deploy inicial na Vercel, o build falhava na verificação de
TypeScript. Causa raiz: parte do código (rotas dinâmicas e algumas páginas)
usava o padrão de `params`/`cookies()` **assíncronos**, que só existe a
partir do Next.js **15** — mas `package.json` fixa **Next 14.2.5 / React
18.3.1** deliberadamente, e essa versão não deve mudar. Esta rodada revisou
o projeto inteiro (`src/` completo, todas as rotas do App Router, hooks,
utilitários e componentes compartilhados) e corrigiu tudo o que não era
compatível com a versão realmente instalada — sem alterar nenhuma regra de
negócio, visual ou arquitetura:

- **`params`/`cookies()` revertidos para o padrão síncrono do Next 14** em:
  `api/v1/tables/[id]`, `api/v1/menu/categories/[id]`,
  `api/v1/menu/items/[id]`, `(admin)/cardapio/produtos/[id]`,
  `(admin)/pedidos/[id]`, `(public)/[slug]/orders/[orderId]`,
  `(public)/[slug]/menu`, `(public)/[slug]/mesa/[token]` e
  `lib/supabase/server.ts` (`cookies()` agora chamado sem `await` — no Next
  14 ele já é síncrono).
- **Dois erros reais de `typedRoutes`** (`next.config.mjs`): em
  `components/dashboard/quick-actions.tsx` e
  `components/dashboard/onboarding-checklist.tsx`, os itens de navegação
  tinham `href: string` numa interface local — isso "alarga" o tipo literal
  de `ROUTES.*` (que é `as const`) de volta para `string` genérico antes de
  chegar em `<Link>`/`<ButtonLink>`, e `typedRoutes` exige uma rota literal
  conhecida em tempo de compilação. Corrigido tipando `href: Route`
  (importado de `"next"`) nos dois lugares.
- **`login-form.tsx`** (correção já aplicada antes desta rodada, mantida):
  `redirect_to` (vindo de `useSearchParams()`) é validado como caminho
  interno antes do cast para `Route`, evitando tanto o erro de tipo quanto
  um open redirect.
- Confirmado, com revisão completa de todo o `src/`: nenhum import quebrado,
  nenhuma entidade JSX não escapada, nenhuma lista sem `key`, nenhum
  componente com hook sem `"use client"`, e nenhuma API exclusiva de
  React 19/Next 15+ (`useActionState`, `use()`, `unstable_after`, etc.) — o
  projeto já era compatível com React 18 em todo o resto.

**Limitação do ambiente onde esta correção foi feita:** sem acesso de rede
para `npm install`, não foi possível rodar `next build`/`tsc --noEmit`/
`next lint` de fato contra as dependências reais do projeto. A verificação
foi feita revisando manualmente arquivo por arquivo, mais uma checagem
sintática com o compilador TypeScript local (sem os tipos reais de React/
Next/Supabase instalados, o que gera muito ruído de "módulo não encontrado"
irrelevante, filtrado manualmente). **Antes do próximo deploy, vale rodar
`npm install && npx tsc --noEmit && npm run lint && npm run build`
localmente ou confiar no próprio build da Vercel** — que agora deve ter
apenas os dois pontos acima (já corrigidos) como possíveis causas de falha
de tipo.

## Auditoria de fundação (pós-Sprint 6, antes da Sprint 7)

Antes de iniciar qualquer módulo novo, esta rodada de auditoria validou o
projeto inteiro contra `docs/api-contracts-v1.md` e as migrations, e rodou
`tsc --noEmit` / `next lint` (nenhum dos dois fazia parte do processo de
verificação anterior — o projeto nunca havia compilado limpo). Os problemas
reais encontrados e já corrigidos:

- **`lib/api/validation.ts` não tipava corretamente schemas com `.default(...)`.**
  `parseOrThrow` recebia `schema: ZodSchema<T>` — um alias que fixa
  `Input = T` — incompatível com qualquer schema cujo tipo de entrada
  difira da saída (ex.: `listMenuItemsQuerySchema`, onde `page`/`per_page`
  aceitam `number | undefined` na entrada mas sempre saem como `number`
  depois do `.default(...)`). Isso quebrava a build (`tsc`) em
  `api/v1/menu/items/route.ts`, devolvendo `page`/`per_page` como
  `number | undefined` mesmo já validados. Corrigido generalizando a
  assinatura para `<S extends ZodTypeAny>(schema: S, input: unknown): z.infer<S>`.
- **`lib/dashboard/queries.ts` não compilava.** `getRecentOrders` acessava
  `order.tables?.name`, mas o parsing estrutural da string do `.select()`
  do `postgrest-js` infere relações embutidas como array por padrão
  (independente de `Database` estar tipado) — `order.tables` era
  `{ name: any }[]`, sem `.name`. Corrigido com um cast explícito
  documentando que, em tempo de execução, `orders → tables` é *many-to-one*
  (um único objeto, não lista).
- **`lib/supabase/server.ts` e `lib/supabase/middleware.ts` não compilavam.**
  O parâmetro `cookiesToSet` de `setAll` chegava como `any` implícito —
  gotcha conhecido de `@supabase/ssr` com TypeScript estrito (a sobrecarga
  depreciada de `createServerClient`, que não tem `getAll`/`setAll`, atrapalha
  a tipagem contextual do objeto literal passado). Corrigido anotando o
  parâmetro explicitamente com o tipo esperado por `CookieMethodsServer`.
- **`.eslintrc.json` não rodava em nenhum arquivo.** A config sobrescrevia
  `@typescript-eslint/no-unused-vars`, mas `eslint-config-next` só traz
  `@typescript-eslint/parser` como dependência — não o
  `@typescript-eslint/eslint-plugin`, que é quem registra as regras desse
  namespace. `next lint` falhava com "Definition for rule ... was not found"
  em **todo** arquivo do projeto. Corrigido adicionando
  `@typescript-eslint/eslint-plugin` (`package.json`) e registrando
  `parser`/`plugins`/`plugin:@typescript-eslint/recommended` em
  `.eslintrc.json`. Um import não utilizado (`ReactNode` em
  `components/ui/form-field.tsx`) só ficou visível depois desse conserto.
- **`components/cardapio/categories-manager.tsx`:** o destructuring do
  retorno de `Array.prototype.splice` não compilava sob
  `noUncheckedIndexedAccess` (`tsconfig.json`). Corrigido com um guard
  explícito em vez de silenciar com non-null assertion.
- **`lib/validations/menu.ts` — `reorderCategoriesSchema` aceitava listas
  com id repetido.** A Route Handler (`menu/categories/order/route.ts`)
  validava "mesmo conjunto de categorias" comparando tamanhos de `Set`, o
  que não pega um `ordered_ids` com um id duplicado e outro ausente (o
  conjunto de membros distintos pode coincidir mesmo assim). Adicionado
  `.refine` de unicidade no schema.

Nenhuma dessas correções muda contrato, schema de banco ou comportamento
documentado — são todas correções de tipo/lint que já deveriam ter barrado
a build. `npx tsc --noEmit` e `npx next lint` rodam limpos após esta
auditoria.

**Fora do escopo desta auditoria (observado, não corrigido):** `next@14.2.5`
está com uma vulnerabilidade de segurança conhecida (aviso do próprio
`npm install`, ver changelog oficial do Next.js) e várias versões majors
atrás do lançamento atual. Atualizar é uma mudança maior (breaking changes
prováveis entre 14→16) que merece sua própria sprint de manutenção, com
testes de regressão completos — não uma correção pontual de fundação.

## Configurações do Restaurante (Sprint 9)

Fecha o último endpoint pendente da v1 (contrato seção 4.2) e substitui o
placeholder de `(admin)/configuracoes`.

### Auditoria realizada antes desta sprint

Repetiu-se o processo já estabelecido nas sprints anteriores — desta vez com
acesso de rede real para `npm install` pela primeira vez, o que permitiu
rodar `npx tsc --noEmit`, `npx next lint` e `npx next build` de verdade
(não apenas revisão manual). Isso encontrou e corrigiu dois problemas reais
de tipo deixados pela Sprint 8, sem alterar nenhum comportamento:

- **`api/v1/orders/route.ts` e `api/v1/orders/[id]/route.ts` não compilavam.**
  Mesma causa raiz já documentada em `lib/dashboard/queries.ts`
  (`getRecentOrders`, Sprint 5/6): `orders.table_id` é *many-to-one*, mas o
  parsing estrutural do `.select()` do postgrest-js infere a relação
  embutida (`table:tables(id, name)`) como array por padrão — o compilador
  via `row.table`/`order.table` como `{ id: any; name: any }[]`, sem
  `.id`/`.name`. Corrigido com o mesmo cast explícito documentando a
  cardinalidade real em tempo de execução.
- **`components/cardapio-cliente/cart-context.tsx` não compilava.**
  `addItem` fazia `next[existingIndex].quantity` depois de um `findIndex` —
  sob `noUncheckedIndexedAccess` (tsconfig), o acesso por índice é tipado
  como possivelmente `undefined` mesmo vindo de um índice já validado.
  Corrigido com um guard explícito, mesmo padrão já usado em
  `categories-manager.tsx` (Sprint 6) para o mesmo tipo de problema.

Também resolvida a divergência de versão do Next.js (14 vs 15) identificada
na análise anterior a esta sprint — ver "Versão do Next.js: divergência
resolvida" no topo deste documento.

Nenhuma outra inconsistência de rota, import ou contrato foi encontrada;
`PATCH /api/v1/restaurant` era o único stub `501` restante da v1.

### Endpoint (contrato seção 4.2)

- `lib/validations/restaurant.ts`: `updateRestaurantSchema` — `name` e
  `slug` opcionais (payload de PATCH parcial, conforme contrato), mas
  quando `slug` é enviado, precisa respeitar o formato "somente letras
  minúsculas, números e hífen" (mesma regra já usada implicitamente por
  `lib/slug.ts` no onboarding).
- `api/v1/restaurant/route.ts`: `PATCH` implementado por completo (stub
  removido). Usa `requireOwner()` (não `requireSession()`) — o contrato
  restringe este endpoint ao papel `owner`, ao contrário do Cardápio/Mesas.
  Conflito de slug (`23505`) vira `409 CONFLICT`; resposta de sucesso segue
  o mesmo formato de 4.1, sem o campo `checklist` (específico do Dashboard).

### RLS desta sprint

Nenhuma migration nova foi necessária. `supabase/migrations/0003_onboarding.sql`
já criou `update_own_restaurant_as_owner` (política de `update` em
`restaurants` restrita a `id in (... role = 'owner')`) — auditada e
confirmada como correta e suficiente para este endpoint; alterá-la sem
necessidade contrariaria a própria orientação desta sprint.

### Interface Administrativa (`(admin)/configuracoes`)

- `(admin)/configuracoes/page.tsx`: Server Component que carrega o
  restaurante atual via `getRestaurantOverview` (mesma função já usada pelo
  Dashboard e por `GET /api/v1/restaurant` — evita round-trip HTTP da
  própria página para a própria API) e entrega para
  `<RestaurantSettingsForm>`.
- `components/configuracoes/restaurant-settings-form.tsx`: mostra os dados
  atuais (nome, slug, status via novo `RestaurantStatusBadge`, e a URL
  pública do cardápio montada no cliente a partir de `window.location.origin`
  — mesmo padrão já usado para os QR Codes) e um formulário de edição.
  Envia no PATCH só os campos que de fato mudaram (evita `409` por reenviar
  o slug já salvo). Feedback via `toast`/`FormField`, mesmo padrão de
  `CategoriesManager`.
- **Impacto da mudança de slug:** o slug é usado tanto na URL pública do
  cardápio (`/{slug}/menu`, `/{slug}/mesa/{token}`...) quanto codificado
  dentro de cada QR Code já impresso (`components/mesas/table-qr-modal.tsx`).
  Trocar o slug **invalida imediatamente** QR Codes já impressos e qualquer
  link já compartilhado com o cliente final — não existe (nem esta sprint
  implementa) nenhum mecanismo de redirecionamento do slug antigo para o
  novo, porque isso exigiria mudar a resolução pública por slug (seção 3 do
  contrato) para também aceitar slugs históricos, uma mudança de contrato e
  de schema (precisaria de uma tabela de slugs antigos), não apenas de tela
  — fora do escopo desta sprint. Por isso, a troca de slug exige confirmação
  explícita do usuário (`<ConfirmDialog>`) explicando essa consequência antes
  de a chamada à API ser feita; nenhuma mudança de arquitetura foi feita
  para compensar o problema, só o aviso.
- `components/ui/badge.tsx`: adicionado `RestaurantStatusBadge`, seguindo
  exatamente o mesmo padrão já usado por `OrderStatusBadge`/`TableStatusBadge`
  (aditivo — nenhum badge existente foi alterado).

## Pedidos Administrativos, Área do Cliente e Realtime (Sprint 8)

> **Nota de documentação (Sprint 9):** esta seção foi escrita retroativamente.
> O código desta sprint (rotas, `lib/orders/*`,
> `supabase/migrations/0007_orders_module.sql`) já existia completo no projeto
> antes desta rodada, mas nunca havia sido documentado aqui — a seção "O que
> fica fora do escopo desta fundação" (fim deste documento) ainda listava
> "Área do Cliente pública" e "Pedidos administrativos" como itens futuros,
> o que não refletia mais o estado real do código. Esta seção reconstrói o
> racional a partir do que o código implementa, para reconciliar a
> documentação com a realidade antes de iniciar a Sprint 9.

### Área do Cliente pública (contrato seção 3)

- `lib/orders/resolve-public-context.ts`: resolve `slug` → restaurante e
  `token` → mesa, usados por todos os endpoints públicos abaixo. Como não há
  sessão de usuário nesses endpoints, usam `createAdminClient()` (service
  role, ignora RLS) — o próprio código, não o Postgres, garante o isolamento
  por tenant, validando `slug`/`table_token` explicitamente antes de
  qualquer leitura/escrita (mesmo raciocínio já usado no onboarding, seção
  2.1).
- `GET /api/v1/public/{slug}/tables/{token}` (3.1): retorna
  restaurante + mesa + pedido ativo, se houver (`lib/orders/active-order.ts`).
- `GET /api/v1/public/{slug}/menu` (3.2): `lib/orders/public-menu.ts`.
- `POST /api/v1/public/{slug}/orders` (3.3): `lib/orders/create-order.ts` —
  revalida preço/disponibilidade de cada item no servidor no momento do
  envio (nunca confia no que o front-end carregou antes), conforme exigido
  pelo contrato.
- `GET /api/v1/public/{slug}/orders/{orderId}` (3.4):
  `lib/orders/get-public-order-status.ts`.
- Front-end: `(public)/[slug]/menu`, `/carrinho`, `/checkout`,
  `/orders/[orderId]` — carrinho em `components/cardapio-cliente/cart-context.tsx`
  (estado em `sessionStorage`, isolado por `slug` + `tableToken`).

### Pedidos Administrativos (contrato seção 8)

- `lib/orders/status-transitions.ts`: a máquina de estados
  (`pending → preparing → ready → delivered`, com `cancelled` a partir de
  qualquer estado não-terminal) vive aqui, não numa `check constraint` — a
  mensagem `422 INVALID_STATUS_TRANSITION` precisa do `details` com estado
  atual e solicitado (8.3), algo que uma constraint de banco não expressa
  (mesmo raciocínio já registrado para outras regras de negócio no restante
  deste documento).
- `GET /api/v1/orders` (8.1), `GET /api/v1/orders/{id}` (8.2),
  `PATCH /api/v1/orders/{id}/status` (8.3) implementados por completo.
- `(admin)/pedidos` e `(admin)/pedidos/[id]`: tela de Pedidos em Tempo Real.

### Realtime (contrato seção 1.10)

- `lib/realtime/channels.ts`: helpers para os canais
  `restaurant:{restaurant_id}:orders` (painel administrativo) e
  `orders:id=eq.{id}` (acompanhamento de um pedido específico, usado tanto
  no painel quanto na Área do Cliente) — inscrição feita direto no
  componente client-side que precisa dela, sem endpoint REST próprio para
  "assinar" um canal.

### RLS desta sprint

`supabase/migrations/0007_orders_module.sql`: `update` em `orders` (8.3),
`select` em `order_items` (8.2) e `update` em `order_sessions` (encerrar a
comanda ao chegar num status terminal). Nenhuma política de `insert` para a
criação pública de pedidos (3.3) — o endpoint público usa service role,
mesmo raciocínio do onboarding.

## Mesas e QR Codes (Sprint 7)

### Auditoria realizada antes desta sprint

Repetiu-se o mesmo processo da auditoria anterior (seção acima), desta vez
focada no estado deixado pela Sprint 6: contrato (seção 7), migrations
(`0001` a `0005`) e o código já existente do módulo de Mesas. Nenhuma
inconsistência de tipo, lint, rota, import ou duplicação foi encontrada — os
endpoints já implementados antes desta sprint (`7.5`, `print-confirmation`)
continuam corretos e não foram tocados. Os únicos quatro endpoints da seção 7
ainda eram stubs `501` (`7.1`–`7.4`), como já registrado no README.

**Limitação do ambiente desta rodada, para deixar registrado:** o ambiente
onde esta auditoria/implementação rodou não tem acesso de rede para
`npm install` (o registro retornou `403 Forbidden`), então não foi possível
instalar as dependências reais do projeto (Next, Supabase, Zod, tipos do
React) nem executar `npm run type-check`, `npm run lint` ou `npm run build`
de fato contra a árvore de dependências do projeto. Todo o código desta
sprint foi escrito manualmente seguindo — linha a linha — os mesmos padrões
já auditados e aprovados dos módulos de Cardápio e Onboarding (mesmo
esqueleto de Route Handler, mesmo uso de `parseOrThrow`/`AppError`/
`apiSuccess`, mesmos componentes de `src/components/ui`), e revisado com o
compilador TypeScript disponível localmente como checagem sintática (sem
resolução de módulos reais, portanto sem garantia equivalente a um
`tsc --noEmit` completo). **Antes de considerar esta sprint pronta para
deploy, rode `npm install && npm run type-check && npm run lint && npm run
build` em um ambiente com acesso à internet** — isso não substitui essa
verificação, só reduz o risco de erro até lá.

### CRUD de Mesas (contrato seção 7.1–7.4)

- `lib/validations/tables.ts`: `createTableSchema` (nome opcional — contrato
  7.2) e `updateTableSchema` (nome e status, ambos opcionais — contrato 7.3),
  mesmo padrão de `lib/validations/menu.ts`.
- `api/v1/tables/route.ts` e `api/v1/tables/[id]/route.ts`: stubs `501`
  removidos, `GET`/`POST`/`PATCH`/`DELETE` implementados por completo.
- **Nome automático (7.2):** quando `name` não é informado, o próximo número
  sequencial é gerado a partir da contagem atual de mesas do restaurante
  (`Mesa 01`, `Mesa 02`, ...), com retentativa em caso de conflito de
  unicidade — mesmo espírito da retentativa de slug do onboarding
  (`lib/slug.ts`), necessário porque nomes podem ter sido alterados
  manualmente (7.3) e a contagem bruta nem sempre aponta pra um número livre.
- **Exclusão (7.4) não pode reusar o padrão de FK do Cardápio:**
  `order_sessions.table_id` é `on delete cascade` (`0001_initial_schema.sql`),
  não `restrict` como `menu_items.category_id`/`order_items.menu_item_id` —
  então o banco nunca bloquearia sozinho a exclusão de uma mesa com comanda
  aberta. O Route Handler consulta `order_sessions` (`closed_at is null`)
  antes de excluir e responde `409 CONFLICT` explicitamente, exatamente como
  o contrato pede ("não pode excluir mesa com order_session em aberto").
- `supabase/migrations/0006_tables_management_policies.sql`: políticas de
  `insert`/`update`/`delete` em `tables` para qualquer usuário autenticado do
  restaurante (a seção 7 do contrato não restringe a `owner`, ao contrário do
  onboarding — mesmo raciocínio já aplicado ao Cardápio em `0005`) + a
  política de `select` em `order_sessions` necessária para a checagem de
  exclusão acima funcionar sob RLS (sem ela, a consulta sempre voltaria
  vazia, mascarando comandas abertas reais — mesmo raciocínio de
  `0004_dashboard_reads.sql`).

### QR Codes: o que "gerar/regenerar" significa nesta sprint

O contrato (seção 7) não define nenhum endpoint de imagem nem de reemissão de
`qr_token` — o token já nasce pronto na criação da mesa (`tables.qr_token`,
`default encode(gen_random_bytes(16), 'hex')`, migration `0001`) e a
renderização visual do QR Code é responsabilidade do front-end, mesmo padrão
já estabelecido em `components/onboarding/table-qr-code.tsx`. Por isso, nesta
tela administrativa, "ver/gerar QR Code" e "regenerar QR Code" significam a
mesma coisa: renderizar novamente a imagem a partir do `qr_token` já
existente (`components/mesas/table-qr-modal.tsx`, com opção de baixar o PNG).
Emitir um novo `qr_token` para uma mesa já criada — o que invalidaria QR
Codes já impressos — não está previsto em nenhuma seção do contrato e não foi
implementado; se isso vier a ser necessário, é uma mudança de contrato antes
de ser uma mudança de código.

### Interface Administrativa (`(admin)/mesas`)

- `(admin)/mesas/page.tsx`: Server Component que carrega a lista de mesas e
  o `slug` do restaurante direto do Supabase (mesmo padrão do Dashboard e de
  `(admin)/cardapio/categorias` — ler direto em vez de chamar a própria API)
  e entrega para `<TablesManager>`.
- `components/mesas/tables-manager.tsx`: lista em `<Table>` (componentes de
  `src/components/ui`) com nome em `font-mono` (dado, conforme o Design
  System), badge de status (`TableStatusBadge`) + `<Select>` para mudança
  rápida de status, e os mesmos padrões de modal de criação/edição e
  `ConfirmDialog` de exclusão já usados em `CategoriesManager`.
- `components/mesas/table-qr-modal.tsx`: componente novo (não reaproveita
  `components/onboarding/table-qr-code.tsx`, para não alterar código fora do
  escopo desta sprint) que renderiza o QR Code em tamanho maior com botão de
  download do PNG.

## Cardápio (Sprint 6)

### Correção de fundação aplicada antes desta sprint

A pasta `supabase/migrations/` chegou a esta sprint com **duas migrations
`0004`** (`0004_dashboard.sql` e `0004_dashboard_reads.sql`), criadas em
paralelo e nunca conciliadas — ambas tentavam recriar a mesma política
`select_own_orders` em `public.orders`, o que faria a segunda a rodar
falhar (`policy already exists`). Como o código (`get-restaurant-overview.ts`)
e este README já referenciavam `0004_dashboard_reads.sql` como a fonte da
verdade, essa foi a versão mantida; `0004_dashboard.sql` (rascunho
alternativo, com uma política extra de leitura em `order_items` fora do
escopo documentado da Sprint 5) foi removida. Nenhum código de aplicação
referenciava o arquivo removido.

### CRUD de Categorias e Produtos (contrato seções 5 e 6)

- `lib/validations/menu.ts`: schemas Zod de criação/edição de categoria e
  produto, reordenação de categorias e query string de listagem de
  produtos — mesmo padrão dos demais módulos (usados no formulário e no
  Route Handler).
- Route Handlers em `api/v1/menu/categories` e `api/v1/menu/items`
  implementados por completo (antes, stubs `501`): listagem, criação,
  edição, exclusão e reordenação de categorias; listagem paginada
  (`?category_id=`, `?page=`, `?per_page=`), criação, obtenção, edição e
  exclusão de produtos.
- **Exclusão sem checagem prévia duplicada:** tanto "categoria com produtos
  vinculados" (5.4) quanto "produto usado em pedido histórico" (6.5) já são
  impedidos pelas constraints `on delete restrict` criadas em
  `0001_initial_schema.sql` (`menu_items.category_id` e
  `order_items.menu_item_id`). Os Route Handlers apenas tentam o `delete` e
  traduzem a violação de chave estrangeira (`23503`) em `409 CONFLICT` com
  a orientação certa — evita uma consulta de contagem separada (e uma
  política de RLS de leitura extra só para isso) sujeita a condição de
  corrida.
- `supabase/migrations/0005_menu_write_policies.sql`: políticas de
  `insert`/`update`/`delete` para `menu_categories` e `menu_items`,
  liberadas para qualquer usuário autenticado do restaurante (sem exigir
  `role = 'owner'` — o contrato não restringe o módulo de Cardápio dessa
  forma, ao contrário da seção 4.2 de Configurações).
- Front-end: `(admin)/cardapio/categorias` (lista + criação/edição via
  modal + exclusão + reordenação por arrastar-e-soltar nativo, sem
  biblioteca externa) e `(admin)/cardapio/produtos` (listagem paginada,
  filtro por categoria, toggle rápido de disponibilidade, criação/edição
  via `<ProductForm>` compartilhado entre o modal de criação e a página de
  detalhe `produtos/[id]`).
- `image_url` do produto é um campo de texto simples (URL já hospedada) —
  o próprio contrato define o campo como resultado de um upload prévio ao
  Supabase Storage; o fluxo de upload em si fica fora do escopo desta
  sprint de CRUD.

## Autenticação (Sprint 3)

- Login, logout e recuperação de senha são feitos **direto pelo SDK do
  Supabase Auth no cliente** (`lib/supabase/client.ts`) — não existe (nem
  deveria existir) endpoint próprio para isso; ver contrato seção 9.
- `src/components/auth/`: `LoginForm`, `ForgotPasswordForm`,
  `ResetPasswordForm`, `LogoutButton` — todos client components, validados
  com os schemas de `lib/validations/auth.ts` antes de chamar o SDK.
- `lib/auth/error-messages.ts` traduz erros do Supabase Auth (mensagens em
  inglês) para português, sem nunca revelar se um e-mail existe na base.
- `middleware.ts` redireciona nos dois sentidos: sem sessão + rota admin →
  `/login`; com sessão + `/login` → `/dashboard`.
- `lib/api/auth.ts` (`requireSession`/`requireOwner`) é a segunda camada de
  segurança usada dentro de cada Route Handler administrativo — resolve o
  `restaurant_id` consultando `profiles`, e depende da policy de RLS em
  `supabase/migrations/0002_auth_policies.sql`.

## Dashboard (Sprint 5)

### Server Components lendo o banco direto — quando é permitido

`GET /api/v1/restaurant` (contrato seção 4.1) continua sendo a única forma
"oficial"/versionada de obter restaurante + checklist. Mas o Dashboard
(`(admin)/dashboard/page.tsx`) **não chama essa Route Handler via fetch** —
um Server Component fazer HTTP para a própria API do mesmo app é round-trip
desnecessário. Em vez disso, tanto a Route Handler quanto o Dashboard
chamam a mesma função compartilhada
(`lib/restaurant/get-restaurant-overview.ts`), cada um lendo só os campos
que precisa. **Regra geral:** dado de exibição específico de uma página
(contagens agregadas, listagens de leitura) pode ser buscado direto do
Supabase por um Server Component; qualquer escrita, ou dado consumido por
mais de uma superfície (ex.: um futuro app mobile), passa pelo contrato de
API de verdade.

### `requirePageSession()` vs `requireSession()`

- `lib/api/auth.ts` → `requireSession()`/`requireOwner()`: para **Route
  Handlers**, lança `AppError` (vira `401`/`403` no envelope de resposta).
- `lib/auth/require-page-session.ts` → `requirePageSession()`: para
  **Server Components de página**, redireciona (`next/navigation`) em vez
  de lançar erro — não existe envelope de API numa página. Envolvida em
  `cache()` do React: chamar várias vezes no mesmo request (layout + página
  + componentes) só consulta o banco uma vez.

### Dashboard modular — um Suspense por seção

Cada widget (`RestaurantStatusHeader`, `SummaryCards`, `OnboardingChecklist`,
`RecentOrders`) é um Server Component assíncrono independente, com seu
próprio `<Suspense>` (skeleton em `components/dashboard/skeletons.tsx`) e
seu próprio `try/catch` (erro inline via `SectionError`) — uma seção lenta
ou com falha nunca trava as outras. Ao adicionar um módulo novo (Cardápio,
Pedidos), o padrão é: nova função de leitura em `lib/<módulo>/queries.ts` +
novo componente de seção + registrar no grid do `dashboard/page.tsx`.
`QuickActions` já aponta para as rotas de Categorias/Produtos/Mesas — nada
muda ali quando essas telas ganharem funcionalidade real.

### Novidades no Design System: `buttonVariants` e `ButtonLink`

`components/ui/button.tsx` agora exporta `buttonVariants(variant, size)` —
as classes do botão sem o elemento em si. Use `<ButtonLink>`
(`components/ui/button-link.tsx`) sempre que o "botão" precisar navegar
(`<Link>` do Next.js), nunca aninhe um `<Link>` dentro de um `<Button>`.

### RLS desta sprint

`supabase/migrations/0004_dashboard_reads.sql`: políticas de `SELECT` para
`menu_categories`, `menu_items` e `orders` — necessárias para os contadores
do Dashboard funcionarem corretamente assim que esses módulos existirem
(sem elas, `count` sempre voltaria 0 por causa do RLS, mesmo com dados).

## Onboarding (Sprint 4)

Fluxo sequencial de 3 passos, todo dentro do grupo `(auth)` (ainda sem
sessão administrativa completa até o fim do passo 3):

1. **`/onboarding/restaurante`** (`SignupForm`) → `POST /api/v1/onboarding/restaurant`
   (público, sem sessão). Cria o usuário no Supabase Auth (Admin API),
   depois restaurante + profile **na mesma transação Postgres** via a
   função `create_restaurant_with_owner` (`supabase/migrations/0003_onboarding.sql`).
   Se qualquer etapa após a criação do usuário falhar, o usuário é excluído
   (compensação manual — não há transação única possível entre a Auth API e
   o Postgres). O slug é gerado a partir do nome do restaurante
   (`lib/slug.ts`) com retentativa automática em caso de conflito de
   unicidade (`-2`, `-3`, ...). A resposta já inclui uma sessão pronta
   (`access_token`/`refresh_token`), que o front-end persiste via
   `supabase.auth.setSession(...)` — o usuário nunca precisa logar de novo
   logo após o cadastro.

2. **`/onboarding/mesas`** (`TablesForm`, estágio "quantity") →
   `POST /api/v1/onboarding/tables` (autenticado, `requireOwner`). Cria N
   mesas numeradas (`Mesa 01`, `Mesa 02`, ...); só pode ser chamado uma vez
   por restaurante (verificado por contagem existente, não por status).

3. Mesma página, estágio **"review"** — mostra o QR Code de cada mesa
   (gerado no cliente com a lib `qrcode`, a partir de
   `{origin}/{slug}/mesa/{qr_token}`) e um botão "Confirmar impressão", que
   chama `POST /api/v1/tables/qr-codes/print-confirmation`. Essa chamada
   grava `qr_codes_printed_at` e transiciona `restaurants.status` de
   `onboarding` para `active` — **nesta sprint, essa é a única condição da
   transição** (o contrato completo também condiciona à existência de
   categorias/produtos, seção 4.1, mas esse checklist só existe a partir do
   módulo de Cardápio). Revisar `print-confirmation/route.ts` quando esse
   módulo for implementado.

O `slug` retornado no passo 1 trafega para o passo 3 via
`lib/onboarding-session.ts` (uma chave efêmera em `sessionStorage` — não é
persistência de negócio, só uma ponte entre as páginas do wizard).

### RLS adicionada nesta sprint

`supabase/migrations/0003_onboarding.sql`: `select`/`update` de
`restaurants` e `select`/`insert` de `tables`, todas restritas ao
`restaurant_id` do usuário autenticado (via `profiles`). A criação de
restaurante+profile em si roda dentro da função `SECURITY DEFINER`
(bypassa RLS deliberadamente, só pode ser chamada pela service role).

## Design System

A identidade visual e a biblioteca de componentes ("conceito Comanda") estão
documentadas em `docs/design-system.md`, com o racional completo de cores,
tipografia e acessibilidade. A vitrine viva de todos os componentes roda em
`/design-system` (fora do grupo `(admin)`, sem exigir login).

Toda tela nova **deve** ser composta a partir de `src/components/ui` — nunca
criar elementos de formulário ou feedback soltos.

## Stack

- **Next.js 15** (App Router, `params`/`cookies()` assíncronos) + **React 18**
  + **TypeScript** (strict mode) — versão confirmada na Sprint 9 (ver "Versão
  do Next.js: divergência resolvida", no topo deste documento)
- **Tailwind CSS** para estilo
- **Supabase** (Postgres + Auth + Realtime + Storage)
- **Zod** para validação de payloads no servidor

Nenhuma biblioteca de UI/component library de terceiros por padrão — os
primitivos ficam em `src/components/ui`.

## Estrutura de pastas

```
mesaflow/
├── middleware.ts                 # Renovação de sessão + proteção de rotas admin
├── src/
│   ├── app/
│   │   ├── (public)/[slug]/      # Área do Cliente — sem login, acesso via QR Code
│   │   ├── (auth)/               # Login e onboarding
│   │   ├── (admin)/              # Painel administrativo (protegido por sessão)
│   │   ├── api/v1/               # Route Handlers — espelham api-contracts-v1.md 1:1
│   │   ├── layout.tsx            # Root layout
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                   # Primitivos (Button, Input, Card, Badge...)
│   │   ├── layout/                # Sidebar, header, shells de layout
│   │   ├── admin/                 # Componentes específicos do painel
│   │   └── public/                # Componentes específicos da Área do Cliente
│   ├── lib/
│   │   ├── supabase/              # client.ts, server.ts, middleware.ts, admin.ts
│   │   └── api/                   # response.ts, errors.ts, validation.ts, auth.ts, stub.ts
│   ├── types/                     # domain.ts, api.ts, database.types.ts (gerado)
│   ├── constants/                 # routes.ts, error-codes.ts
│   └── hooks/
└── supabase/
    ├── config.toml
    └── migrations/                 # Schema versionado (SQL puro)
```

### Por que grupos de rotas `(public)`, `(auth)`, `(admin)`

Os parênteses não entram na URL — servem só para dar a cada área o seu
próprio `layout.tsx` sem afetar o path. `(admin)` é onde o `middleware.ts`
aplica a checagem de sessão; `(public)` nunca passa por essa checagem.

## Convenções de código

### Rotas de API (`src/app/api/v1`)

- Estrutura de pastas **espelha exatamente** a numeração do
  `api-contracts-v1.md` (seções 2 a 8). Ao implementar um endpoint, comece
  pelo comentário já deixado no topo do arquivo apontando a seção do contrato.
- Todo Route Handler segue o mesmo esqueleto:

  ```ts
  export async function POST(request: Request) {
    try {
      const session = await requireSession(); // ou requireOwner()
      const body = await request.json();
      const input = parseOrThrow(createCategorySchema, body);

      // ...lógica de negócio...

      return apiCreated(result);
    } catch (err) {
      return handleRouteError(err);
    }
  }
  ```

- **Nunca** montar o envelope de resposta manualmente — usar sempre
  `apiSuccess` / `apiCreated` / `apiNoContent` (`lib/api/response.ts`) e
  `AppError` + `handleRouteError` (`lib/api/errors.ts`).
- Erros de negócio são sempre `AppError` com um código do catálogo fechado
  (`lib/constants/error-codes.ts`) — nunca lançar `Error` genérico numa rota.
- Endpoints ainda não implementados retornam `stubResponse(...)` — isso
  **não** é parte do contrato oficial, é só o marcador desta fase de
  fundação. Remover a chamada ao implementar o endpoint de verdade.

### Autenticação

- `requireSession()` e `requireOwner()` (`lib/api/auth.ts`) resolvem a sessão
  e o `restaurant_id` do usuário autenticado. Chamar sempre no início de
  qualquer Route Handler administrativo, antes de tocar no banco — é a
  segunda camada de segurança da seção 1.6 do contrato (a primeira é RLS).
- Endpoints públicos (`/api/v1/public/...`) nunca chamam essas funções — a
  segurança deles é feita por posse de `slug`/`token`, nunca por sessão.

### Tipos

- `src/types/domain.ts`: entidades de domínio em camelCase, usadas no
  front-end e nos Route Handlers.
- `src/types/database.types.ts`: gerado pelo Supabase CLI
  (`npm run supabase:types`), snake_case, reflete o schema bruto do Postgres.
- **Nunca** vazar o tipo bruto do banco direto para o front-end — mapear na
  borda da API (dentro do Route Handler, antes do `apiSuccess`).

### Realtime

- Canais seguem o padrão do contrato (seção 1.10):
  `restaurant:{restaurant_id}:orders` (painel) e `orders:id=eq.{id}` (pedido
  específico, usado tanto no painel quanto na Área do Cliente).
- A inscrição no canal é feita direto no componente client-side que precisa
  dela — não existe endpoint REST para "assinar" um canal.

### Estilo (Tailwind)

- Tokens de cor/raio ficam em `globals.css` (CSS vars) e são referenciados no
  `tailwind.config.ts` — nunca usar cores hex soltas nos componentes.
- `cn()` (`lib/utils.ts`) para combinar classes condicionalmente.

## Rodando o projeto

```bash
npm install
cp .env.example .env.local   # preencher com as chaves do projeto Supabase
npm run dev
```

Para aplicar o schema local e gerar os tipos:

```bash
supabase start                # requer Docker
supabase db reset             # aplica supabase/migrations/*.sql
npm run supabase:types
```

## Roadmap — v1 concluída, o que vem depois (pós-Sprint 10)

> **Nota (Sprint 9):** esta seção documentava, na fundação inicial do
> projeto (antes da Sprint 3), a ordem sugerida dos módulos ainda por
> implementar. Todos os 7 itens abaixo já foram concluídos — a lista é
> mantida só como registro histórico da ordem original planejada; ver
> "Estado atual do MVP", no topo deste documento, para o estado real.

Módulos da v1, na ordem em que foram de fato implementados:

1. ✅ Autenticação (Sprint 3)
2. ✅ Onboarding (Sprint 4, seções 2.1/2.2)
3. ✅ Dashboard (Sprint 5)
4. ✅ Cardápio — Categorias e Produtos (Sprint 6, seções 5.x/6.x)
5. ✅ Mesas e QR Codes (Sprint 7, seção 7.x)
6. ✅ Área do Cliente pública + Pedidos administrativos + Realtime
   (Sprint 8, seções 3.x/8.x)
7. ✅ Restaurante/Configurações (Sprint 9, seção 4.2)
8. ✅ Auditoria de Qualidade (Sprint 10) — sem novo escopo de contrato,
   fechou o Painel de Pedidos administrativo (front-end que ainda faltava
   do item 6) e revisou consistência, acessibilidade, performance e
   memory leaks de toda a jornada.

Com isso, **a v1 do contrato está implementada por completo** — nenhum
endpoint da seção 9 (Visão Consolidada) retorna mais `stubResponse(...)`, e
nenhuma tela do fluxo principal ficou com "Módulo a implementar".

### Fora do escopo da v1 (ver contrato, seção 10)

Ficam para v1.1 em diante, sem mudança de raciocínio em relação ao que o
próprio contrato já definia:

- Funcionários/convites (expande o modelo de permissões além de só `owner`).
- Variações de produto (`menu_item_variations`) e histórico de status
  (`order_status_history`).
- Pagamentos (PIX), estoque, fidelidade e relatórios (v2.0+).

### Pendências técnicas registradas na Sprint 9 (✅ resolvidas na Sprint 10)

- ~~`console.log` de debug (incluindo verificação de variáveis de ambiente)
  deixado em `api/v1/onboarding/restaurant/route.ts`~~ — removido na Sprint
  10 (auditoria de qualidade tinha escopo irrestrito sobre o código
  existente, ao contrário da Sprint 9, escopada a Configurações).
- ~~`next.config.mjs`: `experimental.typedRoutes` deveria ser apenas
  `typedRoutes`~~ — corrigido na Sprint 10.
