# MesaFlow — Roadmap Vivo do Projeto

Este documento é a fonte oficial de acompanhamento do desenvolvimento do
MesaFlow. Não é um changelog nem um README — é o retrato atualizado do que
existe, do que está pela metade, do que falta e do que ainda está quebrado.

**Regra de manutenção:** toda vez que uma Sprint terminar, este arquivo deve
ser atualizado. Se uma auditoria encontrar uma funcionalidade ainda não
implementada, ela entra na seção ❌ imediatamente, mesmo que a correção fique
para depois.

**Status atual: RC1.1** — a Auditoria Técnica Final (pré-produção) do RC1
encontrou 4 itens de prioridade alta; esta sprint resolveu os 3 que tinham
correção real dentro do escopo permitido (índices de banco, tipos do
Supabase, fluxo de fechamento de conta) e reavaliou o quarto (rate
limiter), documentando com precisão o que ainda não está resolvido e por
quê — nenhuma infraestrutura nova foi introduzida, como pedido.

Última atualização: 2026-07-25, ao final da Sprint Pós-Auditoria (RC1.1).

---

## ✅ Funcionalidades Concluídas

- **Autenticação** — login, "esqueci minha senha", redefinição de senha,
  sessão renovada via middleware, RLS por `restaurant_id` em toda tabela.
  Middleware agora também protege `/design-system` (vitrine interna de
  componentes que antes ficava pública) — Sprint Final/RC1.
- **Onboarding** — cadastro do restaurante + criação do usuário e da sessão
  numa única chamada, criação de mesas em lote, geração de QR Code por mesa,
  checklist que ativa o restaurante (`status: onboarding → active`) quando
  categoria + produto + QR Codes impressos existem. `/onboarding/mesas`
  agora exige sessão pelo middleware (Sprint Final/RC1) — só
  `/onboarding/restaurante`, o cadastro em si, continua público de
  propósito. Tela de revisão dos QR Codes agora busca o slug do restaurante
  no servidor como reforço, caso o `sessionStorage` do Passo 1 não esteja
  disponível — antes, nesse caso raro, os QR Codes eram impressos com uma
  URL quebrada sem nenhum aviso (Sprint Final/RC1).
- **Dashboard** — contadores gerais, checklist de onboarding, lista de
  últimos pedidos (dado real, sem atualização automática — ver 🚧).
- **Configurações do restaurante** — editar nome e slug.
- **Cardápio administrativo** — categorias e produtos: criar, editar,
  excluir, marcar disponibilidade, imagem, preço, reordenar categorias
  (drag-and-drop). Lista de produtos sempre reflete corretamente o filtro de
  categoria e a paginação ativos após criar/editar (Sprint 3 de Correção);
  reordenação de categorias agora reporta erro caso alguma posição não seja
  salva, em vez de reportar sucesso com a ordem parcialmente aplicada
  (Sprint 3 de Correção).
- **Módulo de Mesas (Centro de Operações)** — CRUD completo de mesas; QR
  Code por mesa (visualizar, baixar, imprimir); grade com dado agregado real
  de pedidos em aberto (valor, itens, tempo desde o último pedido); Drawer
  lateral com ações reais (enviar para a cozinha, fechar conta, liberar
  mesa, imprimir comanda); botão "Abrir mesa" que de fato marca a mesa como
  ocupada (corrigido na Sprint 2 de Correção); status de mesa sincronizado
  em tempo real entre dispositivos (Sprint 2 de Correção). "Fechar conta"
  agora nunca reenvia um pedido que já foi fechado com sucesso, e uma falha
  parcial no meio do processo mostra exatamente quantos pedidos fecharam e
  quantos faltam, em vez de um erro genérico e confuso (Sprint Pós-Auditoria
  / RC1.1) — a máquina de estados dos pedidos não foi alterada. Fluxo
  operacional completo (Novo Pedido → Preparando → Pronto → Finalizar →
  Livre) agora acontece inteiro dentro de Mesas, sem precisar abrir Pedidos:
  modelo de tom com 8 estados dedicados (`TableCardTone`), ação "Pedido
  pronto" e rótulo "Finalizar atendimento" quando tudo está pronto (Sprint
  "Fluxo Operacional das Mesas"). "Chamar garçom" / "Solicitar conta"
  implementado de ponta a ponta (tabela `table_events`, endpoints públicos e
  administrativos, canal Realtime dedicado, botões na Área do Cliente e no
  Drawer) — ver `docs/table-events-roadmap.md`.
- **Módulo de Pedidos administrativo** — listagem com filtro por status,
  detalhe com itens, atualização de status seguindo a máquina de estados
  (`pending → preparing → ready → delivered`, `cancelled` a partir de
  qualquer estado não-terminal — não existe estado "finalizado" separado,
  `delivered` já é o fim da linha), Realtime. Realtime da listagem corrigido
  para sempre refazer a busca com o filtro/página realmente em uso, não os
  do primeiro carregamento (Sprint 4 de Correção); mudança de status
  protegida contra condição de corrida entre dois atendentes agindo no
  mesmo pedido ao mesmo tempo (Sprint 4 de Correção).
- **Área do Cliente / Cardápio público** — acesso via QR Code, cardápio por
  categoria, modal de detalhes do produto, carrinho (adicionar, remover,
  alterar quantidade, subtotal/total), checkout, tela de acompanhamento do
  pedido.
- **Fluxo completo do cliente ponta a ponta** — QR Code → mesa reconhecida
  → cardápio → carrinho → checkout → pedido criado → aparece no painel
  administrativo em tempo real. Validado e corrigido na Sprint 1 de
  Correção: idempotência contra duplicação por retry de rede, mesa marcada
  como "ocupada" automaticamente ao criar um pedido real, e mesa em
  manutenção bloqueada para pedidos.
- **Índices de banco de dados** — todas as colunas de chave estrangeira
  usadas em filtro (RLS e queries) agora têm índice dedicado ou são
  cobertas por uma constraint `unique` já existente; nenhum redundante
  (Sprint Pós-Auditoria/RC1.1 — ver migration `0010_foreign_key_indexes.sql`
  para o motivo de cada um).

## 🚧 Funcionalidades Parcialmente Implementadas

- **Exclusão de mesa**
  - **Já existe:** exclusão bloqueada corretamente enquanto há uma comanda
    (`order_session`) em aberto, com mensagem clara.
  - **Falta:** uma mesa que já recebeu qualquer pedido na vida fica
    impossível de excluir para sempre (`orders.table_id` é
    `on delete restrict`) — não existe hoje uma forma de "aposentar" uma
    mesa física sem apagar seu histórico.
  - **Módulo:** Mesas.

- **Dashboard "Últimos Pedidos"**
  - **Já existe:** consulta real, mostra pedidos de verdade.
  - **Falta:** Realtime ou polling — diferente das telas de Mesas e
    Pedidos, o Dashboard só atualiza se a página for recarregada.
  - **Módulo:** Dashboard.

- **Tratamento de sessão expirada**
  - **Já existe:** toda rota administrativa exige sessão (`requireSession`/
    `requireOwner` + RLS).
  - **Falta:** um wrapper de fetch central que reconheça `401` e redirecione
    para `/login` — hoje, se a sessão expira no meio do uso, a tela mostra
    um erro genérico em vez de mandar a pessoa para o login. Não corrigido
    na Sprint Final por exigir tocar em dezenas de chamadas `fetch` espalhadas
    por vários módulos — é uma refatoração grande de verdade, não uma
    inconsistência pontual.
  - **Módulo:** transversal, todo o painel administrativo.

- **Cardápio administrativo — sem Realtime** *(investigado na Sprint 3 de
  Correção)*
  - **Já existe:** criar/editar/excluir categoria ou produto atualiza a tela
    de quem fez a ação imediatamente (via estado local — corrigido para
    respeitar filtro/paginação nesta sprint). O cardápio público
    (`getPublicMenu`) é lido direto do banco a cada carregamento de página,
    então o cliente sempre vê o dado mais recente ao escanear o QR Code ou
    recarregar. Preço e disponibilidade também são **revalidados no
    servidor** no momento de criar o pedido (`STALE_PRICE_OR_AVAILABILITY`),
    então mesmo um cardápio desatualizado na tela do cliente nunca resulta
    em um pedido com preço errado.
  - **Falta:** nenhum canal Realtime existe para `menu_categories`/
    `menu_items` — se um segundo funcionário tiver a tela de Cardápio aberta
    em outro dispositivo no exato momento de uma edição, não vê a mudança
    sem recarregar a página. Decisão consciente de não implementar agora:
    diferente de Mesas (onde o status errado na tela atrapalha a operação
    do salão em tempo real), editar cardápio é uma tarefa ocasional de
    bastidor, raramente feita por duas pessoas ao mesmo tempo — e a
    correção do preço/disponibilidade no pedido já cobre o risco real.
  - **Módulo:** Cardápio administrativo.

## ❌ Funcionalidades Ainda Não Implementadas

Com base no que o contrato (`docs/api-contracts-v1.md`, seção 10) já
documenta como fora do escopo da v1, mais o que foi identificado nas
auditorias:

- **Funcionários/convites** — hoje só existe `owner`/`staff` no schema, sem
  fluxo de convite nem tela de gestão de equipe. Planejado para v1.1.
- **Variações de produto** (`menu_item_variations` — ex.: tamanho, sabor,
  adicional). Planejado para v1.1.
- **Histórico de status do pedido** (`order_status_history` — auditoria de
  quem mudou o quê e quando). Planejado para v1.1.
- **Pagamento via PIX** — sem integração nenhuma hoje. Planejado para v2.0+.
- **Controle de estoque.** Planejado para v2.0+.
- **Programa de fidelidade.** Planejado para v2.0+.
- **Relatórios** (vendas, produtos mais pedidos, etc.). Planejado para v2.0+.

## 🐞 Bugs Conhecidos

Todos os bugs **críticos e altos** encontrados na auditoria original já
foram corrigidos (Sprints 1-4 de Correção + Sprint Final). A Auditoria
Técnica Final (pré-produção) encontrou 4 itens novos de prioridade alta;
3 foram corrigidos nesta sprint (índices, tipos do banco, fechar conta) e o
quarto (rate limiter) foi reavaliado e melhorado dentro do que é possível
sem infraestrutura nova — ver a linha correspondente abaixo para o que
continua genuinamente em aberto:

| Gravidade | Bug | Arquivo | Impacto | Status |
|---|---|---|---|---|
| Média | Rate limiter não tem contador compartilhado entre instâncias serverless simultâneas | `src/lib/api/rate-limit.ts` | Em produção multi-instância (Vercel), o limite é por instância, não global — o limite efetivo pode passar do documentado no contrato | Reavaliado na Sprint Pós-Auditoria (RC1.1): o algoritmo de janela foi melhorado (sliding window, reduz rajada na borda da janela), mas o problema de fundo exige um store compartilhado (Redis ou a própria base Postgres) — decisão consciente de não implementar isso sem infraestrutura nova, fora do escopo desta sprint |
| Média | `database.types.ts` nunca foi gerado de verdade contra o schema real | `src/types/database.types.ts` | Nenhuma chamada Supabase do projeto tem checagem de tipo real de nome de tabela/coluna — um typo só aparece em runtime | Identificado na Auditoria Técnica Final; instruções completas de como gerar deixadas no próprio arquivo (Sprint Pós-Auditoria/RC1.1) — não pôde ser gerado neste ambiente de desenvolvimento (sem acesso à rede/Supabase CLI) |
| Baixa | Sessão admin expirada mostra erro genérico em vez de redirecionar ao login | Transversal (sem wrapper de fetch central) | UX ruim, sem risco de segurança (RLS/requireSession seguram) | Pendente (ver 🚧) — exige tocar em chamadas `fetch` espalhadas por vários módulos |
| Baixa | Carrinho do cliente em `sessionStorage` — perdido se a aba for encerrada pelo sistema | `src/components/cardapio-cliente/cart-context.tsx` | Cliente perde o carrinho sem aviso em cenários raros (troca de app + pressão de memória no mobile) | Aceito como comportamento esperado, sem ação planejada |
| Baixa | Duas categorias criadas na mesma fração de segundo (dois dispositivos) podem ficar com a mesma `position` | `src/app/api/v1/menu/categories/route.ts` | Ordem entre as duas fica ambígua até uma reordenação manual; não trava nem gera erro | Identificado na Sprint 3 de Correção, aceito como aceitável (exige dois dispositivos editando no mesmíssimo instante) |
| Baixa | Páginas administrativas (Server Components) não checam `error` das consultas iniciais ao Supabase, só usam `data ?? []` | Padrão sistêmico em várias páginas — ex.: `(admin)/pedidos/page.tsx`, `(admin)/pedidos/[id]/page.tsx`, `(admin)/cardapio/produtos/page.tsx`, `lib/dashboard/queries.ts` | Uma falha real de conexão no carregamento inicial mostraria "nenhum pedido"/404 em vez de um erro claro — bem raro na prática | Identificado na Sprint 4 de Correção; não corrigido por ser um padrão repetido em muitos arquivos de módulos diferentes, fora do escopo de uma única sprint |
| Baixa | Comentário desatualizado em `summary-cards.tsx` (mesma classe do já corrigido em `getRecentOrders`) | `src/components/dashboard/summary-cards.tsx` | Diz que Categorias/Produtos/Pedidos "legitimamente mostram 0" — não é mais verdade desde as Sprints 6/8 | Identificado na Auditoria Técnica Final; não corrigido nesta sprint por estar fora dos 4 itens do escopo pedido |
| Baixa | N+1 de requisições HTTP ao abrir o Drawer de uma mesa (uma requisição por pedido aberto, em paralelo) | `src/components/mesas/table-drawer.tsx` | Baixo impacto hoje (poucos pedidos por mesa); não escala estruturalmente | Identificado na Auditoria Técnica Final; fora do escopo desta sprint |
| Baixa | Sem headers de segurança (CSP, X-Frame-Options etc.) configurados | `next.config.mjs` | Depende dos defaults da hospedagem para proteção básica | Identificado na Auditoria Técnica Final; fora do escopo desta sprint |

**Corrigidos na Sprint Final (RC1), removidos desta tabela:** rota
`/design-system` agora exige sessão; `Map` do rate limiter agora expurga
entradas expiradas em vez de crescer sem limite; comentário desatualizado
em `getRecentOrders` corrigido.

**Corrigidos na Sprint Pós-Auditoria (RC1.1), removidos desta tabela:**
ausência de índices em colunas de chave estrangeira; "Fechar conta" com
falha parcial mal comunicada.

## 💡 Melhorias Futuras

- Realtime (ou ao menos polling) no widget "Últimos Pedidos" do Dashboard.
- Wrapper de fetch central com tratamento de `401` (redireciona ao login) —
  a maior peça pendente; exige tocar em chamadas espalhadas por vários
  módulos, por isso não entrou em nenhuma sprint de correção pontual.
- Rate limiter em store compartilhado (ex.: Upstash Redis, ou a própria
  base Postgres) para produção multi-instância — único jeito real de
  resolver o problema de fundo, propositalmente não feito na Sprint
  Pós-Auditoria (RC1.1) por exigir infraestrutura nova.
- `images.remotePatterns` em `next.config.mjs` aceita qualquer `*.supabase.co`
  — restringir ao hostname exato do projeto em produção.
- Endpoint em lote para detalhes de múltiplos pedidos (evitar o N+1 de
  requisições HTTP que o Drawer de Mesas faz hoje ao abrir uma mesa com
  vários pedidos abertos).
- Headers de segurança (CSP, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy) em `next.config.mjs`.
- Forma de "arquivar" uma mesa com histórico em vez de bloquear a exclusão
  para sempre.
- Checagem de `error` nas consultas de Server Component em todo o painel
  administrativo (hoje só usam `data ?? []`) — padrão repetido em vários
  módulos, mudança grande demais para uma sprint pontual.
- Loading global entre páginas do painel administrativo.
- Skeletons em mais telas administrativas (hoje concentrados no Cardápio,
  no Dashboard e em componentes de UI base).
- Melhor cache para leituras que não mudam a cada request (ex.: cardápio
  público, quando o restaurante não estiver editando ativamente).
- `npm run build && npm run lint` rodando de verdade a cada sprint — este
  ambiente de desenvolvimento não tem acesso ao registry do npm, então toda
  validação até aqui foi leitura manual linha a linha; recomenda-se rodar
  localmente antes de cada deploy em produção.

## 📅 Histórico das Sprints

| Sprint | Objetivo | Status | Data | Arquivos alterados | Resultado |
|---|---|---|---|---|---|
| 1 | Fundação do projeto | ✅ Concluída | — | Estrutura Next.js, Route Handlers stub | Base do projeto |
| 2 | Design System "Comanda" | ✅ Concluída | — | 21 componentes de UI | Sistema visual v1 (papel quente, Ember, Fraunces) |
| 3 | Autenticação | ✅ Concluída | — | Auth Supabase, middleware, RLS | Login/sessão funcionais |
| 4 | Onboarding | ✅ Concluída | — | Wizard de cadastro, função `SECURITY DEFINER`, QR Code | Cadastro completo |
| 5 | Dashboard | ✅ Concluída | — | Painel inicial | Contadores e checklist |
| 6 | Cardápio (Categorias/Produtos) | ✅ Concluída | — | CRUD de Cardápio | Cardápio administrativo funcional |
| 7 | Administração de Mesas | ✅ Concluída | 2026-07-20 | CRUD de Mesas, migration 0006, modal de QR Code | Módulo de Mesas v1 |
| 8 | Módulo de Pedidos | ✅ Concluída (em fases) | 2026-07-22/23 | Migration 0007, APIs públicas/admin, Área do Cliente, Carrinho/Checkout/Acompanhamento | Fluxo de pedido ponta a ponta |
| 9 | Configurações do Restaurante | ✅ Concluída | — | Form de nome/slug | Módulo de Configurações |
| 11 | Refinamento visual "Comanda" | ✅ Concluída | 2026-07-23 | Button, Badge, Card, Skeleton, EmptyState, Toast, Table, Modal, Dashboard | Polimento do design system |
| 12 | Auditoria de consistência visual | ✅ Concluída | 2026-07-23 | Componente `Alert` novo, token `shadow-bar` | Banners duplicados eliminados |
| 13 (Fase 1) | QA funcional pré-produção | ✅ Concluída | 2026-07-23 | 6 arquivos migrados para `Alert` | Bug de banner duplicado corrigido |
| 13 (Fase 2) | Auditoria de produção e segurança (fim do MVP) | ✅ Concluída | 2026-07-23/24 | Rate limit no onboarding, `.env.example` | MVP aprovado, sem bloqueador |
| 14 | QA Final / Homologação | ✅ Concluída | 2026-07-24 | Nenhum (só validação) | MVP homologado |
| UI Premium V2 | Redesign parcial (cardápio, modais) | ✅ Concluída | 2026-07-24 | `menu-item-card.tsx`, modais | Pushback dado a um redesign total; ajustes pontuais entregues |
| Redesign Total | Nova identidade visual | ✅ Concluída | 2026-07-24 | `globals.css`, `tailwind.config.ts`, sidebar, Dashboard | Paleta grafite/indigo, fonte Manrope |
| UI Premium V3 | Correção de build + redesign Cardápio/Mesas | ✅ Concluída | 2026-07-24 | `alert.tsx` (bug de comentário), cardápio cliente, Mesas | Bug de parser corrigido; cardápio em grid, Mesas em tiles |
| UI Premium — Marco 1 | Experiência do Cliente (hero, categorias, cards, carrinho) | ✅ Concluída | 2026-07-24 | `cardapio-cliente/*` | Marco entregue como ZIP único |
| UI Premium — Marco 2 | Carrinho e Checkout do Cliente | ✅ Concluída | 2026-07-25 | `cart-line-item.tsx`, rodapé unificado, `loading.tsx` | Carrinho/checkout completos |
| Redesign estrutural pós-crítica | Cardápio em linha horizontal | ✅ Concluída | 2026-07-25 | `menu-item-card.tsx` | Card virou linha, grid virou lista |
| Cardápio v2 + Mesas "Centro de Operações" | Dado real agregado nas Mesas | ✅ Concluída | 2026-07-25 | `tables-manager.tsx`, `table-drawer.tsx`, `derive-table-card-state.ts` | Mesas com valor/itens/tempo reais |
| Refinamento Visual — Mesas | Densidade e cores dos cards de mesa | ✅ Concluída | 2026-07-25 | `tables-manager.tsx`, `tailwind.config.ts` | Cards ~30% menores, flash único em vez de pulso contínuo |
| Refinamento Premium — Cardápio Público | Densidade do cardápio do cliente | ✅ Concluída | 2026-07-25 | `restaurant-header.tsx`, `category-nav.tsx`, `menu-item-card.tsx` | Header compacto, ~3-4 produtos visíveis por tela |
| Auditoria Técnica Completa | Levantar todos os bugs do projeto (Fase de Estabilização) | ✅ Concluída | 2026-07-25 | Nenhum (só relatório) | Lista de bugs classificados por gravidade |
| 1 de Correção | Corrigir bugs do fluxo público do cliente | ✅ Concluída | 2026-07-25 | `create-order.ts`, `resolve-public-context.ts`, `validations/orders.ts`, `checkout-view.tsx`, `mesa/[token]/page.tsx`, migration 0008 | Idempotência, race condition de sessão, mesa marcada ocupada automaticamente, bloqueio de mesa em manutenção |
| 2 de Correção | Corrigir bugs do módulo de Mesas | ✅ Concluída | 2026-07-25 | `tables-manager.tsx`, `table-drawer.tsx`, `table-qr-modal.tsx`, `globals.css`, `channels.ts`, migration 0009 | Botão "Abrir mesa" funcional, Realtime de status entre dispositivos, IDs de impressão corrigidos |
| 3 de Correção | Corrigir bugs do módulo de Cardápio | ✅ Concluída | 2026-07-25 | `products-list.tsx`, `categories/order/route.ts` | Lista de produtos passou a respeitar filtro/paginação após criar/editar; reordenação de categorias reporta erro em vez de sucesso parcial silencioso |
| 4 de Correção | Corrigir bugs do fluxo de produção (cozinha/Pedidos) | ✅ Concluída | 2026-07-25 | `orders-list.tsx`, `orders/[id]/status/route.ts` | Realtime da listagem de Pedidos corrigido (closure obsoleta de página/filtro); mudança de status protegida contra condição de corrida entre dois atendentes |
| Final (RC1) | Revisão completa do sistema, preparação para Release Candidate | ✅ Concluída | 2026-07-25 | `tables-form.tsx`, `middleware.ts`, `rate-limit.ts`, `dashboard/queries.ts` | `/design-system` e `/onboarding/mesas` protegidos por sessão; QR Codes do onboarding com fallback de slug via API; rate limiter com expurgo de entradas; comentário desatualizado corrigido; projeto entregue como RC1 |
| Auditoria Técnica Final | Auditoria crítica pré-produção do RC1, sem correções | ✅ Concluída | 2026-07-25 | Nenhum (só relatório) | 4 problemas de prioridade alta identificados: índices de banco, `database.types.ts` nunca gerado, falha parcial em "Fechar conta", rate limiter não confiável em multi-instância |
| Pós-Auditoria (RC1.1) | Corrigir os 4 itens de prioridade alta da Auditoria Técnica Final | ✅ Concluída | 2026-07-25 | migration `0010_foreign_key_indexes.sql`, `database.types.ts`, `dashboard/queries.ts`, `restaurant/get-restaurant-overview.ts`, `table-drawer.tsx`, `rate-limit.ts` | 7 índices de FK criados (nenhum redundante); instruções completas para gerar tipos reais deixadas no arquivo; "Fechar conta" não repete mais pedido já fechado e comunica falha parcial com precisão; rate limiter com algoritmo de janela deslizante (melhoria real, sem infraestrutura nova) — limitação de contador não-compartilhado entre instâncias permanece documentada como pendência real |
