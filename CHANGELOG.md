# Changelog

Todas as mudanças notáveis do MesaFlow neste ciclo de migração visual (série UI-06) e da revisão de Product Design que a sucedeu.

## [Não versionado] — Revisão de Product Design (Mesas)

### Alterado
- Tela de Mesas reprojetada como fluxo visual único: "existe algum problema?" → "quantas mesas ocupadas?" → "onde agir agora?" → "qual mesa abrir?".
- Novo bloco condicional "Precisa de atenção agora" — só renderiza quando existe pelo menos uma mesa com pedido aguardando, garçom chamado ou conta pedida; **não renderiza nada** (nem mensagem de "tudo ok") quando não há pendência — o silêncio visual é intencional.
- KPIs divididos em duas camadas: 4 indicadores operacionais (livres/ocupadas/manutenção/pedidos) com peso pleno; "Valor em aberto"/"Ticket médio" rebaixados a uma linha de texto quieta, sem cartão.
- Cards de mesa com sombra variável por "humor" do estado (`free`/`maintenance` mais rasos e calmos; `new_order`/`bill_requested` com profundidade máxima já em repouso, sem depender de hover).
- Corrigido um log de debug (`pushMesasDebugLog`) que espelhava uma versão desatualizada do `className` do card, de antes dos redesigns anteriores.

### Removido
- Ícones de `Wallet`/`TrendingUp` (sem uso após a reorganização dos KPIs) e `CheckCircle2` (sem uso após o bloco de atenção virar totalmente condicional).

## [Não versionado] — Redesign Estrutural e Refinamento Visual (Mesas)

### Alterado
- Cards de mesa reconstruídos do zero: fundo sólido de grafite profundo (nunca mais só contorno), radius maior, sombra elegante em repouso, número da mesa dominante (`text-6xl`), status discreto, grupo de ações unificado (QR/Editar/Excluir como uma única peça com divisores internos), botão principal integrado como rodapé nativo do card (sangra até as bordas, sem parecer "colocado por cima").
- Header da tela e barra de KPIs redesenhados: mais espaço em branco, sem quadradinho colorido atrás de ícone, filtro convertido em segmented control.
- Ações principais (QR/Editar/Excluir) permanecem sempre visíveis — nunca dependem de hover (requisito mobile-first).
- Paleta de estados recalibrada: Livre = grafite neutro; Ocupada/Preparando/Pronto = grafite com verde sutil; Novo pedido = grafite com laranja sutil; Manutenção/Conta solicitada = grafite com vermelho sutil. Sem dourado, sem azul como segunda cor de marca.

## [Não versionado] — UI-06: Migração para o MesaFlow Visual Language v1.0

### Adicionado
- `MesaFlow Visual Language v1.0` — especificação oficial de cores, tipografia, espaçamento, radius, sombra, motion e acessibilidade para todo o painel administrativo.
- Foco visível nativo (`focus-visible` com anel `ds2-ring`) em `Button`, campos de formulário, Sidebar e demais elementos interativos do Admin.
- Indicador de severidade correto em `Toast`: erros usam `role="alert"`/`aria-live="assertive"`; sucesso/aviso/informação continuam `role="status"`/`aria-live="polite"`.

### Alterado
- Todos os componentes compartilhados do Admin (`Button`, `Card`, `Badge`, `Input`, `Select`, `Textarea`, `Modal`, `Toast`, `Alert`, `ConfirmDialog`, `Checkbox`, `Switch`, `Pagination`, `Table`, `Accordion`, `EmptyState`, `FormField`, `Label`, `Skeleton`, `Spinner`) migrados dos tokens legados (`--primary` dourado, `--surface`, `--muted`) para os tokens `ds2-*` (grafite + verde, única cor de marca).
- Shell administrativo (`Sidebar`, `Header`, `(admin)/layout.tsx`) migrado — `.ds2-dark` passou a ser o tema real da raiz do painel, substituindo a coexistência anterior entre o tema legado dourado e a DS2.
- `RestaurantStatusBadge` tornou-se a única fonte de verdade para o texto de status do restaurante (Dashboard e Configurações mostravam textos divergentes antes).
- "Chamando garçom" deixou de ser um tom de mesa (`waiter_call`) e passou a ser um indicador independente (`hasWaiterCall`), coexistindo com o tom operacional real da mesa.

### Removido
- Dependência de `.btn-primary-surface` (classe legada dourada) em todos os componentes administrativos — permanece só como dívida técnica registrada para o Cardápio do cliente (público, fora do escopo desta série).
- 8 wrappers `.ds2-dark` locais (aplicados individualmente por tela nas sprints iniciais da migração), consolidados na raiz do shell.
- Tokens `--chrome-*` (5 tokens) sem consumidor restante no Admin.

### Corrigido
- Regressão em que `PATCH /api/v1/orders/{id}/status` fechava a `order_session` automaticamente como efeito colateral de "Finalizar pedido" — responsabilidade isolada exclusivamente em `close_table_bill`.
- Botão `primary` renderizava dourado (não verde) em toda tela já migrada para `.ds2-dark`, por depender de uma classe CSS legada nunca antes revisada.

## [Não versionado] — Fundação DS2 e Sprints Operacionais (Mesas/Dashboard)

### Adicionado
- Design System 2.0 (`ds2-dark`): fundação de tokens de cor, tipografia, radius e sombra.
- Dashboard reprojetado como central operacional: "Existem ações pendentes" (prioridade: pedidos aguardando → chamando garçom → conta pedida), "Mesas ocupadas", "Resumo de hoje".
- Indicador de pedido não processado (`hasUnprocessedOrders`) e destaque visual/sonoro de novo pedido em mesa já ocupada, com regra de som desacoplada do status da mesa (baseada na quantidade de pedidos).
- Botão "Continuar comprando" na tela de acompanhamento do cliente — reaproveita a mesma `order_session`.
- Tela do cliente reprojetada como "Sua comanda" (resumo + timeline de todos os pedidos da sessão, não só o último).

### Corrigido
- Pedidos finalizados desaparecendo do card da mesa (`fetchOperations` não buscava status `delivered`).
- Mesa livre exibindo dados de comanda fantasma de uma sessão já encerrada — `order_session.closed_at` tornou-se a única fonte de verdade para operações de mesa.
