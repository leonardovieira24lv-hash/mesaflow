# MesaFlow

SaaS de pedidos via QR Code para restaurantes. Este documento é a fundação
técnica do projeto: estrutura, convenções e como cada módulo futuro deve se
encaixar. O contrato de API oficial (front-end ↔ back-end) vive em
`api-contracts-v1.md` e é a fonte da verdade para payloads, códigos de erro e
comportamento dos endpoints — este README nunca deve contradizê-lo.

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

- **Next.js 14** (App Router) + **React 18** + **TypeScript** (strict mode)
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

## O que fica fora do escopo desta fundação

Nenhuma lógica de negócio foi implementada nesta etapa — apenas estrutura,
configuração e stubs. Os próximos módulos (nesta ordem sugerida) são:

1. Autenticação (login + `requireSession`/`requireOwner` reais)
2. Onboarding (2.1, 2.2)
3. Restaurante/Configurações (4.1, 4.2)
4. Cardápio — Categorias e Produtos (5.x, 6.x)
5. Mesas e QR Codes (7.x)
6. Área do Cliente pública (3.x)
7. Pedidos administrativos + Realtime (8.x)

Também fora do escopo da v1 (ver seção 10 do contrato): funcionários/convites,
variações de produto, histórico de status, pagamentos, estoque, fidelidade e
relatórios.
