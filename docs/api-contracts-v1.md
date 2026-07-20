# Contratos de API — v1
## SaaS de Pedidos via QR Code

**Papel:** Arquitetura de API / Contrato oficial front-end ↔ back-end
**Escopo:** Todos os endpoints necessários para sustentar as 18 telas já validadas em UX/UI.
**Status:** Especificação — nenhum código de implementação neste documento.

---

## 1. Princípios Gerais da API

Estas regras valem para **todo** endpoint documentado a seguir, e existem para que a API se comporte como um produto (estável, previsível, documentável) e não como um conjunto de rotas ad-hoc.

### 1.1 Versionamento

Toda rota vive sob o prefixo `/api/v1/...`. Isso significa que, se um dia for necessário quebrar compatibilidade (mudar formato de payload, remover campo), a v2 nasce em paralelo (`/api/v2/...`) sem quebrar integrações existentes — inclusive futuras integrações de terceiros (delivery, totens) que venham a consumir esta mesma API.

### 1.2 Convenção REST de recursos

- **Substantivos no plural para coleções**: `/orders`, `/tables`, `/menu/items` — nunca verbos na URL (ex.: nunca `/getOrders` ou `/createOrder`).
- **Hierarquia refletida na URL apenas quando há posse direta**: `/menu/categories` e `/menu/items` (itens pertencem ao domínio "menu", mas não são aninhados como `/menu/categories/{id}/items` porque um item também precisa ser listado/filtrado independentemente da categoria).
- **Ações que não são CRUD puro viram sub-recursos, nunca verbos soltos**: por exemplo, avançar o status de um pedido é `PATCH /orders/{id}/status` (um sub-recurso "status" sendo atualizado), não `POST /orders/{id}/advance-status`.
- **Um único endpoint por responsabilidade**: nenhuma ação do sistema tem dois caminhos possíveis (ex.: alternar disponibilidade de um produto usa o mesmo `PATCH /menu/items/{id}` de qualquer outra edição, em vez de um endpoint extra só para isso).

### 1.3 Formato Padrão de Resposta

Toda resposta, de sucesso ou erro, segue um envelope único — o front-end nunca precisa adivinhar o formato de acordo com o endpoint.

**Sucesso (uma entidade ou lista):**
```
{
  "data": { ... }              // objeto ou array, dependendo do endpoint
}
```

**Sucesso com paginação (listas grandes, ex.: pedidos, produtos):**
```
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 143,
    "total_pages": 8
  }
}
```

**Erro (sempre com a mesma estrutura, independentemente do tipo de erro):**
```
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Descrição legível do problema, segura para exibir ao usuário",
    "details": [
      { "field": "price", "issue": "Deve ser um número maior que zero" }
    ]
  }
}
```

O campo `details` é opcional (usado principalmente em `VALIDATION_ERROR`) e o campo `code` é um valor estável de um conjunto fechado (seção 1.5) — o front-end deve poder decidir o comportamento da tela (qual mensagem mostrar, se deve reautenticar, etc.) a partir do `code`, nunca fazendo *parsing* da string de `message`.

### 1.4 Códigos HTTP

| Código | Quando usar |
|---|---|
| `200 OK` | Sucesso em `GET`, `PATCH` ou ações que não criam recurso novo. |
| `201 Created` | Sucesso em `POST` que cria um novo recurso (retorna o recurso criado no corpo). |
| `204 No Content` | Sucesso em `DELETE` (sem corpo de resposta). |
| `400 Bad Request` | Payload malformado (ex.: JSON inválido, tipo de campo errado). |
| `401 Unauthorized` | Ausência de sessão válida, ou token expirado/inválido. |
| `403 Forbidden` | Sessão válida, mas sem permissão para o recurso (ex.: tentar acessar dados de outro restaurante). |
| `404 Not Found` | Recurso inexistente ou fora do escopo do tenant autenticado (ver nota de segurança na seção 1.6). |
| `409 Conflict` | Conflito de estado (ex.: slug já em uso, transição de status de pedido inválida). |
| `422 Unprocessable Entity` | Validação de regra de negócio falhou, mesmo com payload bem formado (ex.: preço divergente no momento da criação do pedido). |
| `429 Too Many Requests` | Limite de requisições excedido (proteção contra abuso, especialmente nos endpoints públicos). |
| `500 Internal Server Error` | Falha inesperada do servidor — nunca deve expor detalhes internos no `message`. |

### 1.5 Catálogo Fechado de Códigos de Erro (`error.code`)

Mantido como um conjunto controlado e documentado (nunca strings livres inventadas endpoint a endpoint), preparado para virar `enum` no futuro OpenAPI:

`VALIDATION_ERROR` · `UNAUTHORIZED` · `FORBIDDEN` · `NOT_FOUND` · `CONFLICT` · `STALE_PRICE_OR_AVAILABILITY` · `INVALID_STATUS_TRANSITION` · `RATE_LIMITED` · `INTERNAL_ERROR`

### 1.6 Autenticação e Autorização

Dois grupos de endpoints, com tratamento de segurança distinto:

- **Endpoints públicos** (`/api/v1/public/...`): usados pela Área do Cliente, sem login. A "autorização" aqui é feita por posse do link (slug do restaurante + token da mesa), nunca por sessão de usuário. Esses endpoints são somente leitura de dados públicos do cardápio, mais a criação de pedidos — nunca expõem dados de outros restaurantes, nunca permitem alterar cardápio ou status.
- **Endpoints administrativos** (todos os demais, sob `/api/v1/...` sem o prefixo `public`): exigem `Authorization: Bearer <token>` com um JWT emitido pelo Supabase Auth. A validação ocorre em duas camadas, propositalmente redundantes:
  1. **RLS no Postgres** (linha de defesa principal, já detalhada na arquitetura): garante que a consulta, mesmo que a camada de API tivesse uma falha, jamais retornaria dados de outro restaurante.
  2. **Verificação na Route Handler**: confirma que existe uma sessão válida e resolve o `restaurant_id` do usuário autenticado antes mesmo de tocar no banco, permitindo devolver `401`/`403` de forma clara e rápida, sem depender apenas do banco para isso.

**Nota de segurança sobre `404` vs `403`:** quando um usuário autenticado tenta acessar um recurso de **outro** restaurante (ex.: `GET /orders/{id}` de um pedido que não é seu), a API responde `404 Not Found`, não `403 Forbidden`. Isso evita vazar a informação de que o recurso existe — prática padrão de segurança para não permitir "enumeração" de IDs de outros tenants.

### 1.7 Validação de Entrada

Todo payload de entrada é validado no servidor (Route Handler) antes de qualquer escrita no banco — **nunca confiando apenas na validação do formulário do front-end**, já que o front-end pode ser contornado. Cada endpoint documenta suas validações específicas na seção correspondente; validações estruturais comuns (tipo de campo, presença de campo obrigatório) sempre retornam `400`, e validações de regra de negócio (ex.: transição de status inválida) retornam `422` ou `409`, conforme a tabela da seção 1.4.

### 1.8 Preparação para Documentação OpenAPI/Swagger

Toda a nomenclatura e estrutura já seguida neste documento (recursos no plural, envelope único de resposta, catálogo fechado de erros, versionamento por prefixo) foi escolhida por ser **diretamente mapeável para um schema OpenAPI 3.x** no futuro, sem necessidade de redesenhar contratos: cada endpoint aqui vira uma `path`, cada payload vira um `schema` reutilizável, e o catálogo de erros vira `components/responses` compartilhado entre todos os endpoints. A geração do arquivo `openapi.yaml` a partir deste documento é um passo mecânico de tradução, não uma nova etapa de design.

### 1.9 Paginação, Filtros e Ordenação (convenção)

Endpoints de listagem aceitam, quando aplicável: `?page=`, `?per_page=` (paginação), `?status=` (filtro, ex.: em pedidos), `?sort=` (ordenação, ex.: `-created_at` para mais recentes primeiro). Todos os endpoints de listagem seguem a mesma convenção — nenhum endpoint inventa seu próprio esquema de paginação/filtro.

### 1.10 Eventos em Tempo Real

Não são endpoints REST, mas fazem parte do contrato: sempre que uma escrita relevante ocorre (criação/alteração de pedido), a tabela correspondente do Postgres é alterada, e o **Supabase Realtime** propaga automaticamente o evento a quem estiver inscrito no canal daquele `restaurant_id` (painel) ou daquele pedido específico (cliente). Cada endpoint que dispara isso está identificado na sua própria seção.

---

## 2. Onboarding

### 2.1 Criar Conta do Proprietário + Restaurante

- **Objetivo:** primeira etapa do onboarding — cria o usuário, o restaurante e o vínculo `owner` em uma única operação atômica.
- **Método/URL:** `POST /api/v1/onboarding/restaurant`
- **Autenticação:** nenhuma (endpoint público, é o próprio ato de criar a conta). Protegido por rate limiting reforçado (seção 1.4, `429`) para mitigar abuso/spam de contas.
- **Payload de entrada:**
```
{
  "owner_name": "string",
  "restaurant_name": "string",
  "email": "string",
  "password": "string"
}
```
- **Validações:** todos os campos obrigatórios; `email` em formato válido e ainda não cadastrado; `password` conforme política mínima do Supabase Auth (tamanho mínimo); `restaurant_name` com tamanho mínimo de caracteres (evita slugs vazios/inválidos).
- **Resposta de sucesso (`201`):**
```
{
  "data": {
    "restaurant": { "id": "uuid", "name": "string", "slug": "string", "status": "onboarding" },
    "session": { "access_token": "string", "refresh_token": "string" }
  }
}
```
- **Possíveis erros:** `409 CONFLICT` (e-mail já cadastrado), `400 VALIDATION_ERROR` (campos ausentes/inválidos), `429 RATE_LIMITED`, `500 INTERNAL_ERROR`.
- **Tabelas afetadas:** `auth.users` (Supabase Auth), `restaurants` (criação), `profiles` (criação, `role = owner`).
- **Eventos em tempo real:** nenhum (nenhum outro usuário está inscrito neste restaurante ainda).

### 2.2 Criar Mesas em Lote

- **Objetivo:** segunda e última etapa do onboarding — cria N mesas numeradas automaticamente.
- **Método/URL:** `POST /api/v1/onboarding/tables`
- **Autenticação:** obrigatória (sessão do proprietário, já criada no passo anterior).
- **Payload de entrada:**
```
{ "quantity": 12 }
```
- **Validações:** `quantity` inteiro, mínimo 1, máximo definido por regra de negócio (ex.: 200 — acima disso, resposta orienta contato com suporte em vez de criação automática); endpoint só pode ser chamado uma vez por restaurante enquanto `restaurants.status = 'onboarding'` (chamadas repetidas retornam `409`, evitando duplicar mesas por reenvio acidental do formulário).
- **Resposta de sucesso (`201`):**
```
{
  "data": [
    { "id": "uuid", "name": "Mesa 01", "qr_token": "string" },
    { "id": "uuid", "name": "Mesa 02", "qr_token": "string" }
  ]
}
```
- **Possíveis erros:** `400 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `409 CONFLICT` (onboarding de mesas já concluído anteriormente).
- **Tabelas afetadas:** `tables` (criação em lote).
- **Eventos em tempo real:** nenhum.

---

## 3. Área do Cliente (Pública)

Todos os endpoints abaixo usam o prefixo `/api/v1/public/{slug}/...`, onde `{slug}` identifica o restaurante na própria URL — sem isso, seria necessário autenticação para saber "de qual restaurante" se trata, o que contradiz o uso sem login.

### 3.1 Resolver Mesa (identificar sessão)

- **Objetivo:** validar o QR Code escaneado e retornar os dados da mesa/restaurante, incluindo um pedido ativo em andamento, se houver (para retomar o acompanhamento em vez de reiniciar o cardápio).
- **Método/URL:** `GET /api/v1/public/{slug}/tables/{token}`
- **Autenticação:** nenhuma. Segurança feita pela imprevisibilidade do `token` (não sequencial).
- **Payload de entrada:** nenhum (dados na própria URL).
- **Validações:** existência do `slug`; existência e status ativo do `token` dentro daquele restaurante.
- **Resposta de sucesso (`200`):**
```
{
  "data": {
    "restaurant": { "name": "string", "slug": "string" },
    "table": { "id": "uuid", "name": "Mesa 05" },
    "active_order": { "id": "uuid", "status": "preparing" }   // null se não houver pedido ativo
  }
}
```
- **Possíveis erros:** `404 NOT_FOUND` (slug ou token inexistente, ou mesa inativa — mesmo código para ambos os casos, propositalmente, para não revelar qual dos dois falhou).
- **Tabelas afetadas:** nenhuma (somente leitura).
- **Eventos em tempo real:** nenhum.

### 3.2 Obter Cardápio

- **Objetivo:** carregar categorias e produtos disponíveis para montagem do pedido.
- **Método/URL:** `GET /api/v1/public/{slug}/menu`
- **Autenticação:** nenhuma.
- **Payload de entrada:** nenhum.
- **Validações:** existência do `slug`.
- **Resposta de sucesso (`200`):**
```
{
  "data": {
    "categories": [
      {
        "id": "uuid",
        "name": "Lanches",
        "items": [
          { "id": "uuid", "name": "X-Burger", "description": "string", "price": 24.9, "image_url": "string", "is_available": true }
        ]
      }
    ]
  }
}
```
- **Possíveis erros:** `404 NOT_FOUND` (slug inexistente).
- **Tabelas afetadas:** nenhuma (somente leitura, com cache leve na camada de servidor).
- **Eventos em tempo real:** nenhum.

### 3.3 Criar Pedido

- **Objetivo:** enviar o carrinho montado pelo cliente, revalidando preço e disponibilidade no servidor antes de gravar.
- **Método/URL:** `POST /api/v1/public/{slug}/orders`
- **Autenticação:** nenhuma. Protegido por rate limiting por `table_token` (evita flood de pedidos da mesma mesa em curto intervalo).
- **Payload de entrada:**
```
{
  "table_token": "string",
  "notes": "string (opcional)",
  "items": [
    { "menu_item_id": "uuid", "quantity": 2, "notes": "sem cebola (opcional)" }
  ]
}
```
- **Validações:** `table_token` válido e ativo; `items` não vazio; cada `menu_item_id` deve existir, pertencer àquele restaurante e estar com `is_available = true` **no momento do envio** (não confiar no que o front-end carregou antes); `quantity` inteiro maior que zero.
- **Resposta de sucesso (`201`):**
```
{
  "data": {
    "order": { "id": "uuid", "status": "pending", "total_amount": 49.8 }
  }
}
```
- **Possíveis erros:** `404 NOT_FOUND` (token inválido), `422 STALE_PRICE_OR_AVAILABILITY` (com `details` listando exatamente quais itens mudaram de preço ou ficaram indisponíveis, conforme já definido na tela de Carrinho), `400 VALIDATION_ERROR`, `429 RATE_LIMITED`.
- **Tabelas afetadas:** `order_sessions` (criação, se não houver uma sessão aberta para a mesa), `orders` (criação), `order_items` (criação).
- **Eventos em tempo real:** dispara `INSERT` na tabela `orders`, propagado via Supabase Realtime para o canal administrativo `restaurant:{restaurant_id}:orders` (atualiza a tela de Pedidos em Tempo Real automaticamente).

### 3.4 Acompanhar Status do Pedido

- **Objetivo:** alimentar a tela de acompanhamento do cliente.
- **Método/URL:** `GET /api/v1/public/{slug}/orders/{order_id}`
- **Autenticação:** nenhuma. Segurança pela imprevisibilidade do `order_id` (UUID não sequencial) — este endpoint não expõe listagem, apenas leitura direta de um pedido específico que o próprio cliente acabou de criar.
- **Payload de entrada:** nenhum.
- **Validações:** existência do pedido dentro do `slug` informado.
- **Resposta de sucesso (`200`):**
```
{
  "data": {
    "id": "uuid",
    "status": "preparing",
    "items": [ { "name": "X-Burger", "quantity": 2 } ]
  }
}
```
- **Possíveis erros:** `404 NOT_FOUND`.
- **Tabelas afetadas:** nenhuma (somente leitura).
- **Eventos em tempo real:** este endpoint é usado apenas para a carga inicial da tela; as atualizações seguintes chegam via inscrição direta do cliente no canal Realtime `orders:id=eq.{order_id}`, sem necessidade de novas chamadas a este endpoint (evita *polling*).

---

## 4. Restaurante (Configurações)

### 4.1 Obter Restaurante Atual

- **Objetivo:** alimentar o Dashboard (dados gerais + estado do checklist) e a tela de Configurações.
- **Método/URL:** `GET /api/v1/restaurant`
- **Autenticação:** obrigatória.
- **Payload de entrada:** nenhum (o restaurante é resolvido a partir do usuário autenticado, nunca por parâmetro na URL — evita que alguém tente adivinhar/forçar outro `restaurant_id`).
- **Validações:** não aplicável (leitura).
- **Resposta de sucesso (`200`):**
```
{
  "data": {
    "id": "uuid",
    "name": "string",
    "slug": "string",
    "status": "onboarding",
    "checklist": {
      "has_categories": false,
      "has_products": false,
      "qr_codes_printed": false
    }
  }
}
```
- **Possíveis erros:** `401 UNAUTHORIZED`.
- **Tabelas afetadas:** nenhuma (leitura de `restaurants`, mais contagens de `menu_categories`/`menu_items`).
- **Eventos em tempo real:** nenhum.

### 4.2 Atualizar Restaurante

- **Objetivo:** editar nome/slug na tela de Configurações.
- **Método/URL:** `PATCH /api/v1/restaurant`
- **Autenticação:** obrigatória, restrita ao papel `owner` (atendente não deve poder alterar dados administrativos do restaurante — já preparado para quando funcionários existirem).
- **Payload de entrada:**
```
{ "name": "string (opcional)", "slug": "string (opcional)" }
```
- **Validações:** se `slug` for informado, checar unicidade entre todos os restaurantes e formato válido (somente letras minúsculas, números e hífen).
- **Resposta de sucesso (`200`):** objeto do restaurante atualizado, mesmo formato do endpoint 4.1 (sem o campo `checklist`, que é específico da leitura para o Dashboard).
- **Possíveis erros:** `409 CONFLICT` (slug em uso), `400 VALIDATION_ERROR`, `403 FORBIDDEN` (usuário não é `owner`).
- **Tabelas afetadas:** `restaurants` (atualização).
- **Eventos em tempo real:** nenhum.

---

## 5. Cardápio — Categorias

### 5.1 Listar Categorias

- **Objetivo:** alimentar a tela de Cadastro de Categorias e o seletor de categoria na tela de Produtos.
- **Método/URL:** `GET /api/v1/menu/categories`
- **Autenticação:** obrigatória.
- **Payload de entrada:** nenhum. Query opcional `?sort=position` (padrão já ordenado por posição).
- **Resposta de sucesso (`200`):**
```
{ "data": [ { "id": "uuid", "name": "Lanches", "position": 1 } ] }
```
- **Possíveis erros:** `401 UNAUTHORIZED`.
- **Tabelas afetadas:** nenhuma.
- **Eventos em tempo real:** nenhum.

### 5.2 Criar Categoria

- **Método/URL:** `POST /api/v1/menu/categories`
- **Autenticação:** obrigatória.
- **Payload de entrada:** `{ "name": "string" }`
- **Validações:** `name` obrigatório; único dentro do restaurante.
- **Resposta de sucesso (`201`):** objeto da categoria criada (com `position` calculada automaticamente como a última).
- **Possíveis erros:** `409 CONFLICT` (nome duplicado), `400 VALIDATION_ERROR`.
- **Tabelas afetadas:** `menu_categories` (criação).
- **Eventos em tempo real:** nenhum (tela administrativa sem necessidade de tempo real aqui — só o próprio usuário edita o cardápio).

### 5.3 Atualizar Categoria

- **Método/URL:** `PATCH /api/v1/menu/categories/{id}`
- **Autenticação:** obrigatória.
- **Payload de entrada:** `{ "name": "string (opcional)" }`
- **Validações:** mesmas da criação; `id` deve pertencer ao restaurante autenticado (garantido por RLS, retorna `404` caso contrário).
- **Resposta de sucesso (`200`):** objeto atualizado.
- **Possíveis erros:** `404 NOT_FOUND`, `409 CONFLICT`, `400 VALIDATION_ERROR`.
- **Tabelas afetadas:** `menu_categories` (atualização).
- **Eventos em tempo real:** nenhum.

### 5.4 Excluir Categoria

- **Método/URL:** `DELETE /api/v1/menu/categories/{id}`
- **Autenticação:** obrigatória.
- **Validações:** categoria não pode ser excluída se ainda houver produtos vinculados (retorna `409`, orientando o usuário a mover/excluir os produtos primeiro — evita órfãos no banco).
- **Resposta de sucesso:** `204 No Content`.
- **Possíveis erros:** `404 NOT_FOUND`, `409 CONFLICT` (categoria com produtos vinculados).
- **Tabelas afetadas:** `menu_categories` (exclusão).
- **Eventos em tempo real:** nenhum.

### 5.5 Reordenar Categorias

- **Objetivo:** suportar o recurso de arrastar-e-soltar já previsto na tela de Cadastro de Categorias.
- **Método/URL:** `PATCH /api/v1/menu/categories/order`
- **Autenticação:** obrigatória.
- **Payload de entrada:** `{ "ordered_ids": ["uuid", "uuid", "uuid"] }`
- **Validações:** todos os IDs devem pertencer ao restaurante autenticado e representar o conjunto completo de categorias existentes (evita reordenação parcial inconsistente).
- **Resposta de sucesso (`200`):** lista de categorias já na nova ordem (mesmo formato do endpoint 5.1).
- **Possíveis erros:** `400 VALIDATION_ERROR` (lista incompleta ou com ID de outro restaurante).
- **Tabelas afetadas:** `menu_categories` (atualização em lote do campo `position`).
- **Eventos em tempo real:** nenhum.

---

## 6. Cardápio — Produtos

### 6.1 Listar Produtos

- **Método/URL:** `GET /api/v1/menu/items`
- **Autenticação:** obrigatória.
- **Payload de entrada:** query opcionais `?category_id=`, `?page=`, `?per_page=`.
- **Resposta de sucesso (`200`):** lista paginada (formato da seção 1.3), cada item com `id`, `name`, `price`, `category_id`, `is_available`, `image_url`.
- **Possíveis erros:** `401 UNAUTHORIZED`.
- **Tabelas afetadas:** nenhuma.
- **Eventos em tempo real:** nenhum.

### 6.2 Criar Produto

- **Método/URL:** `POST /api/v1/menu/items`
- **Autenticação:** obrigatória.
- **Payload de entrada:**
```
{
  "category_id": "uuid",
  "name": "string",
  "description": "string (opcional)",
  "price": 24.9,
  "image_url": "string (opcional — resultado de upload prévio no Supabase Storage)",
  "is_available": true
}
```
- **Validações:** `category_id` deve existir e pertencer ao restaurante; `name` obrigatório e único dentro da categoria; `price` numérico maior que zero.
- **Resposta de sucesso (`201`):** objeto do produto criado.
- **Possíveis erros:** `404 NOT_FOUND` (categoria inexistente), `409 CONFLICT` (nome duplicado na categoria), `400 VALIDATION_ERROR` (preço inválido).
- **Tabelas afetadas:** `menu_items` (criação).
- **Eventos em tempo real:** nenhum.

### 6.3 Obter Produto

- **Método/URL:** `GET /api/v1/menu/items/{id}`
- **Autenticação:** obrigatória.
- **Resposta de sucesso (`200`):** objeto completo do produto.
- **Possíveis erros:** `404 NOT_FOUND`.
- **Tabelas afetadas:** nenhuma.
- **Eventos em tempo real:** nenhum.

### 6.4 Atualizar Produto

- **Objetivo:** cobre tanto a edição completa quanto a alternância rápida de disponibilidade da tela de listagem (mesmo endpoint, payload parcial — evita endpoint duplicado só para o toggle).
- **Método/URL:** `PATCH /api/v1/menu/items/{id}`
- **Autenticação:** obrigatória.
- **Payload de entrada:** qualquer subconjunto de `{ name, description, price, category_id, image_url, is_available }`.
- **Validações:** mesmas da criação, aplicadas apenas aos campos enviados.
- **Resposta de sucesso (`200`):** objeto atualizado.
- **Possíveis erros:** `404 NOT_FOUND`, `409 CONFLICT`, `400 VALIDATION_ERROR`.
- **Tabelas afetadas:** `menu_items` (atualização).
- **Eventos em tempo real:** nenhum (o cardápio do cliente é buscado sob demanda a cada nova sessão de mesa; propagar isso em tempo real para clientes com o cardápio já aberto fica fora do escopo do MVP).

### 6.5 Excluir Produto

- **Método/URL:** `DELETE /api/v1/menu/items/{id}`
- **Autenticação:** obrigatória.
- **Validações:** produto não pode ser excluído se já existir em `order_items` de algum pedido histórico (preserva integridade do histórico) — nesse caso, a orientação é desativar (`is_available = false`) em vez de excluir, retornando `409` com mensagem explicando a alternativa.
- **Resposta de sucesso:** `204 No Content`.
- **Possíveis erros:** `404 NOT_FOUND`, `409 CONFLICT`.
- **Tabelas afetadas:** `menu_items` (exclusão).
- **Eventos em tempo real:** nenhum.

---

## 7. Mesas e QR Codes

### 7.1 Listar Mesas

- **Método/URL:** `GET /api/v1/tables`
- **Autenticação:** obrigatória.
- **Resposta de sucesso (`200`):** lista de mesas com `id`, `name`, `status`, `qr_token`.
- **Possíveis erros:** `401 UNAUTHORIZED`.
- **Tabelas afetadas:** nenhuma.
- **Eventos em tempo real:** nenhum.

### 7.2 Adicionar Mesa

- **Objetivo:** permitir crescer o número de mesas depois do onboarding (ex.: restaurante expandiu o salão).
- **Método/URL:** `POST /api/v1/tables`
- **Autenticação:** obrigatória.
- **Payload de entrada:** `{ "name": "string (opcional — se omitido, gera automaticamente o próximo número sequencial)" }`
- **Validações:** nome único dentro do restaurante, se informado manualmente.
- **Resposta de sucesso (`201`):** objeto da mesa criada (com `qr_token` já gerado).
- **Possíveis erros:** `409 CONFLICT` (nome duplicado), `400 VALIDATION_ERROR`.
- **Tabelas afetadas:** `tables` (criação).
- **Eventos em tempo real:** nenhum.

### 7.3 Atualizar Mesa

- **Objetivo:** renomear ou alterar status (ex.: colocar em manutenção).
- **Método/URL:** `PATCH /api/v1/tables/{id}`
- **Autenticação:** obrigatória.
- **Payload de entrada:** `{ "name": "string (opcional)", "status": "livre | ocupada | manutencao (opcional)" }`
- **Validações:** `status` deve ser um dos valores permitidos (`400` caso contrário).
- **Resposta de sucesso (`200`):** objeto atualizado.
- **Possíveis erros:** `404 NOT_FOUND`, `400 VALIDATION_ERROR`.
- **Tabelas afetadas:** `tables` (atualização).
- **Eventos em tempo real:** nenhum.

### 7.4 Excluir Mesa

- **Método/URL:** `DELETE /api/v1/tables/{id}`
- **Autenticação:** obrigatória.
- **Validações:** não pode excluir mesa com `order_session` em aberto (retorna `409`, conforme já definido na tela de Gerenciamento de Mesas).
- **Resposta de sucesso:** `204 No Content`.
- **Possíveis erros:** `404 NOT_FOUND`, `409 CONFLICT`.
- **Tabelas afetadas:** `tables` (exclusão).
- **Eventos em tempo real:** nenhum.

### 7.5 Confirmar Impressão dos QR Codes

- **Objetivo:** concluir o terceiro item do checklist de onboarding.
- **Método/URL:** `POST /api/v1/tables/qr-codes/print-confirmation`
- **Autenticação:** obrigatória.
- **Payload de entrada:** nenhum (ação binária — grava o carimbo de data/hora atual).
- **Validações:** nenhuma além da autenticação.
- **Resposta de sucesso (`200`):**
```
{ "data": { "qr_codes_printed_at": "2026-07-13T14:00:00Z" } }
```
- **Possíveis erros:** `401 UNAUTHORIZED`.
- **Tabelas afetadas:** `restaurants` (atualização do campo `qr_codes_printed_at`); se este for o último item pendente do checklist, também atualiza `restaurants.status` de `onboarding` para `active` (mesma transação).
- **Eventos em tempo real:** nenhum.

---

## 8. Pedidos (Administrativo)

### 8.1 Listar Pedidos

- **Objetivo:** alimentar a tela de Pedidos em Tempo Real (carga inicial — atualizações seguintes chegam via Realtime, não por nova chamada a este endpoint).
- **Método/URL:** `GET /api/v1/orders`
- **Autenticação:** obrigatória.
- **Payload de entrada:** query opcionais `?status=pending,preparing,ready,delivered` (filtro por um ou mais status, permitindo montar as colunas do quadro de uma vez ou separadamente), `?page=`, `?per_page=`.
- **Resposta de sucesso (`200`):** lista paginada com `id`, `table`, `status`, `total_amount`, `created_at`, resumo de itens.
- **Possíveis erros:** `401 UNAUTHORIZED`, `400 VALIDATION_ERROR` (valor de `status` fora do conjunto permitido).
- **Tabelas afetadas:** nenhuma.
- **Eventos em tempo real:** nenhum (a tela se inscreve separadamente no canal `restaurant:{id}:orders`, conforme seção 1.10).

### 8.2 Obter Detalhes do Pedido

- **Método/URL:** `GET /api/v1/orders/{id}`
- **Autenticação:** obrigatória.
- **Resposta de sucesso (`200`):** objeto completo, incluindo todos os `order_items` com observações.
- **Possíveis erros:** `404 NOT_FOUND` (inclusive para pedidos de outro restaurante, conforme seção 1.6).
- **Tabelas afetadas:** nenhuma.
- **Eventos em tempo real:** nenhum (tela se inscreve no canal `orders:id=eq.{id}` para refletir mudanças feitas por outro atendente simultaneamente, conforme já previsto na tela de Detalhes do Pedido).

### 8.3 Atualizar Status do Pedido

- **Objetivo:** cobre tanto o avanço normal de status quanto o cancelamento (mesmo endpoint, valor diferente de `status` — evita endpoint duplicado só para cancelamento).
- **Método/URL:** `PATCH /api/v1/orders/{id}/status`
- **Autenticação:** obrigatória.
- **Payload de entrada:** `{ "status": "preparing | ready | delivered | cancelled" }`
- **Validações:** transição deve ser válida conforme a máquina de estados do pedido (ex.: não é possível ir de `pending` direto para `delivered`, nem alterar um pedido já `cancelled` ou já `delivered`) — transição inválida retorna `422 INVALID_STATUS_TRANSITION` com o `details` explicando o status atual e o solicitado.
- **Resposta de sucesso (`200`):** objeto do pedido com o novo status.
- **Possíveis erros:** `404 NOT_FOUND`, `422 INVALID_STATUS_TRANSITION`, `400 VALIDATION_ERROR` (valor de status inexistente no conjunto permitido).
- **Tabelas afetadas:** `orders` (atualização do campo `status`); se o novo status for terminal (`delivered` ou `cancelled`), também pode encerrar a `order_session` correspondente, conforme regra de negócio do restaurante.
- **Eventos em tempo real:** dispara `UPDATE` na tabela `orders`, propagado via Supabase Realtime tanto para o canal administrativo `restaurant:{restaurant_id}:orders` (demais atendentes veem a mudança) quanto para o canal `orders:id=eq.{id}` (o cliente vê o avanço do próprio pedido na tela de Acompanhamento).

---

## 9. Visão Consolidada dos Endpoints

| # | Método | URL | Autenticação |
|---|---|---|---|
| 2.1 | POST | `/api/v1/onboarding/restaurant` | Nenhuma |
| 2.2 | POST | `/api/v1/onboarding/tables` | Sessão do proprietário |
| 3.1 | GET | `/api/v1/public/{slug}/tables/{token}` | Nenhuma |
| 3.2 | GET | `/api/v1/public/{slug}/menu` | Nenhuma |
| 3.3 | POST | `/api/v1/public/{slug}/orders` | Nenhuma |
| 3.4 | GET | `/api/v1/public/{slug}/orders/{order_id}` | Nenhuma |
| 4.1 | GET | `/api/v1/restaurant` | Obrigatória |
| 4.2 | PATCH | `/api/v1/restaurant` | Obrigatória (owner) |
| 5.1 | GET | `/api/v1/menu/categories` | Obrigatória |
| 5.2 | POST | `/api/v1/menu/categories` | Obrigatória |
| 5.3 | PATCH | `/api/v1/menu/categories/{id}` | Obrigatória |
| 5.4 | DELETE | `/api/v1/menu/categories/{id}` | Obrigatória |
| 5.5 | PATCH | `/api/v1/menu/categories/order` | Obrigatória |
| 6.1 | GET | `/api/v1/menu/items` | Obrigatória |
| 6.2 | POST | `/api/v1/menu/items` | Obrigatória |
| 6.3 | GET | `/api/v1/menu/items/{id}` | Obrigatória |
| 6.4 | PATCH | `/api/v1/menu/items/{id}` | Obrigatória |
| 6.5 | DELETE | `/api/v1/menu/items/{id}` | Obrigatória |
| 7.1 | GET | `/api/v1/tables` | Obrigatória |
| 7.2 | POST | `/api/v1/tables` | Obrigatória |
| 7.3 | PATCH | `/api/v1/tables/{id}` | Obrigatória |
| 7.4 | DELETE | `/api/v1/tables/{id}` | Obrigatória |
| 7.5 | POST | `/api/v1/tables/qr-codes/print-confirmation` | Obrigatória |
| 8.1 | GET | `/api/v1/orders` | Obrigatória |
| 8.2 | GET | `/api/v1/orders/{id}` | Obrigatória |
| 8.3 | PATCH | `/api/v1/orders/{id}/status` | Obrigatória |

**Nota:** o Login em si (tela ⑧) não gera um endpoint próprio neste catálogo — é feito diretamente via SDK do Supabase Auth a partir do front-end (`signInWithPassword`), já que essa é uma operação padrão do provedor de autenticação e não uma regra de negócio própria do domínio deste sistema. O mesmo vale para recuperação de senha. Os únicos pontos em que o backend da aplicação participa da autenticação são o onboarding (seção 2), porque ali há criação de dados de negócio junto com a criação do usuário.

---

## 10. O que fica explicitamente fora do escopo da v1 (documentado para não ser esquecido)

- Endpoints de funcionários/convites (aguardam a v1.1, quando o modelo de permissões for expandido).
- Endpoints de variações de produto (`menu_item_variations`) e histórico de status (`order_status_history`) — aguardam v1.1, conforme roadmap já definido.
- Endpoints de pagamento (PIX), estoque, fidelidade e relatórios — todos aguardam versões futuras (v2.0+), mas já têm espaço reservado na convenção de URL (ex.: um futuro `/api/v1/payments` seguiria exatamente o mesmo padrão de envelope, erro e autenticação aqui definido).

Este documento é o contrato oficial entre front-end e back-end para a v1. Qualquer mudança de payload, código de erro ou comportamento deve ser refletida aqui antes de ser implementada.
