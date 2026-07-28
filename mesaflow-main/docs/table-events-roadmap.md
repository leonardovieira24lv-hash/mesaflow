# Roadmap: eventos de mesa (chamar garçom / solicitar conta)

> ✅ **IMPLEMENTADO** — Sprint "Chamar garçom / Solicitar conta" (2026-07-27).
> Este documento continua aqui como referência da especificação original;
> ver `supabase/migrations/0012_table_events.sql`,
> `src/lib/table-events/create-table-event.ts`,
> `src/app/api/v1/public/[slug]/tables/[token]/{call-waiter,request-bill}`,
> `src/app/api/v1/tables/events/`, e a integração em `TablesManager`/
> `TableDrawer`/`TableAssistanceActions`. Duas rotas administrativas saíram
> um pouco diferentes do desenho original abaixo — ver nota de arquitetura
> nos próprios arquivos de rota — porque a leitura precisa ser "todos os
> eventos do restaurante numa chamada" (mesmo padrão de `fetchOperations`),
> não uma consulta por mesa.

Estados pedidos para o Painel de Mesas que **não existem hoje** no backend:
"Cliente chamou o garçom" (azul) e "Cliente solicitou a conta" (vermelho).

O frontend já está preparado para eles (`TableCardAlert`,
`deriveTableCardState` em `src/lib/mesas/derive-table-card-state.ts`) — a
lista `alerts` sempre chega vazia hoje, e nada precisa mudar de forma
quando deixar de chegar vazia. Isto documenta o que falta para isso virar
real.

## 1. Banco de dados

Nova tabela, não um novo valor no enum `TableStatus` — é um evento pontual
que se resolve, não um estado permanente da mesa como `livre`/`ocupada`.

```sql
create table table_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  table_id uuid not null references tables(id),
  type text not null check (type in ('waiter_call', 'bill_request')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id)
);

alter table table_events enable row level security;
-- políticas espelhando as de `orders`: leitura/escrita restrita ao
-- restaurante do usuário autenticado (admin) + criação pública por
-- table_token (cliente), mesmo padrão de `orders`.
```

## 2. API

- `POST /api/v1/public/{slug}/tables/{token}/call-waiter`
- `POST /api/v1/public/{slug}/tables/{token}/request-bill`
  — acesso público por token, mesmo padrão de `POST /api/v1/public/{slug}/orders`.
- `PATCH /api/v1/tables/{tableId}/events/{eventId}` — admin marca `acknowledged`/`resolved`.
- `GET /api/v1/tables/{tableId}/events?status=open` — carga inicial do Painel de Mesas.

## 3. Realtime

Canal por restaurante, mesmo padrão de `restaurantOrdersChannel`
(`src/lib/realtime/channels.ts`):

```ts
export function restaurantTableEventsChannel(restaurantId: string): string {
  return `restaurant:${restaurantId}:table_events`;
}
```

## 4. Frontend — o que muda quando o backend acima existir

Só isto:

1. `TablesManager` passa a buscar `table_events` (mesmo padrão de
   `fetchOperations`) e assina o novo canal.
2. A chamada `deriveTableCardState(table.status, data, [])` deixa de
   receber `[]` fixo e passa a receber os eventos abertos daquela mesa.
3. `TableDrawer` ganha dois botões novos ("Atendido", "Conta impressa/entregue")
   que chamam o `PATCH` acima.

Nenhum componente muda de forma — só a fonte do dado deixa de ser `[]`.
