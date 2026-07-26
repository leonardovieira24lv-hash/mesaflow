/**
 * PLACEHOLDER — este arquivo é gerado automaticamente pelo Supabase CLI e não
 * deve ser editado manualmente. `Database = any` aqui é deliberado: nenhuma
 * geração real foi feita ainda neste projeto (auditoria RC1, item 2).
 *
 * ===========================================================================
 * COMO GERAR OS TIPOS REAIS (rodar no ambiente real, com acesso ao projeto
 * remoto — este arquivo não pode ser gerado neste ambiente de
 * desenvolvimento, que não tem acesso à rede nem ao Supabase CLI):
 * ===========================================================================
 *
 * 1. Instalar o Supabase CLI, se ainda não tiver:
 *      npm install -g supabase
 *
 * 2. Autenticar (uma vez só, fica salvo localmente):
 *      supabase login
 *
 * 3. Garantir que todas as migrations de `supabase/migrations/` já foram
 *    aplicadas ao projeto remoto (`supabase db push`, ou já aplicadas via
 *    o painel do Supabase) — o comando abaixo introspecciona o schema que
 *    está DE FATO no banco remoto, não os arquivos `.sql` locais.
 *
 * 4. Definir `SUPABASE_PROJECT_ID` (o project ref, ex.: "abcdefghijklmnop",
 *    visível em Project Settings → General no painel do Supabase) e rodar:
 *      npm run supabase:types
 *    (o script já existe em package.json e escreve o resultado direto
 *    neste arquivo, substituindo este placeholder por inteiro)
 *
 * 5. Conferir que `export type Database = any;` virou uma definição real
 *    (um objeto com `public: { Tables: {...}, ... }`) e rodar
 *    `npm run type-check` — os únicos dois arquivos que hoje contornam
 *    deliberadamente o placeholder com `SupabaseClient<any>`
 *    (`lib/dashboard/queries.ts`, `lib/restaurant/get-restaurant-overview.ts`)
 *    foram ajustados nesta mesma sprint para usar `SupabaseClient<Database>`
 *    — como isso é idêntico a `any` enquanto o placeholder continuar assim,
 *    a troca não muda nenhum comportamento agora, mas passa a ganhar
 *    checagem de tipo real automaticamente assim que este arquivo for
 *    substituído. Nenhum outro arquivo do projeto precisa de ajuste: todo
 *    cliente Supabase (`lib/supabase/{admin,client,middleware,server}.ts`)
 *    já importa `Database` só daqui, então a substituição deste arquivo é
 *    suficiente sozinha.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
