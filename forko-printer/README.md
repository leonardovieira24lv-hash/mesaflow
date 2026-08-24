# FORKO Printer — agente local (Etapa 3A/3B, modo mock)

Agente que futuramente vai rodar no computador do restaurante, conectado
a uma impressora térmica de verdade. **ESTA VERSÃO AINDA NÃO IMPRIME EM
HARDWARE REAL** — em vez de mandar comando pra impressora, grava um
arquivo de texto (`data/prints/<job-id>.txt`) representando o que seria
impresso.

## Instalação

```
cd forko-printer
npm install
npm run build
```

## Comandos

### `npm run pair`

Pergunta a URL do FORKO, o código de vinculação (gerado em
Configurações → Impressora) e um nome pro dispositivo. Se já existir um
dispositivo pareado, pede confirmação explícita antes de substituir
(nunca sobrescreve silenciosamente).

### `npm run start`

Inicia o polling — pergunta ao servidor se há pedido pra "imprimir" (a
cada 3s; backoff até 15s se a rede cair, resetado assim que uma resposta
válida chega). `Ctrl+C` encerra de forma limpa.

### `npm run status`

Mostra servidor, dispositivo, se está vinculado, se há token configurado
(nunca o token inteiro — só os últimos 4 caracteres), quantos jobs o
journal tem e qual foi o último.

### `npm run journal`

Lista os últimos 20 registros do journal local (mais recente primeiro):
job, status, `ackStatus` (`pending`/`confirmed`), horário, pedido.

### `npm run reset`

Remove o vínculo local (o journal é preservado, útil pra diagnóstico
futuro). Pede confirmação explícita.

### `npm run reset -- --all`

Remove o vínculo **e** o journal/prints mock.

## Testes de robustez (variáveis de ambiente, só nesta fase mock)

- `FORKO_MOCK_FAIL=true` — toda tentativa de "imprimir" falha.
- `FORKO_MOCK_FAIL_ONCE=true` — só a 1ª tentativa de cada job falha; a
  2ª (depois do retry agendado pelo servidor) funciona. Usa o
  `attemptCount` que o próprio servidor já manda, sem contador local.
- `FORKO_MOCK_CRASH_AFTER_PRINT=true` — o processo encerra logo depois
  de gravar o arquivo mock e registrar no journal, mas ANTES de
  confirmar o resultado pro servidor. Ao rodar `npm run start` de novo,
  o job reaparece, o journal reconhece que já foi impresso, e só o ACK é
  reenviado — nenhum 2º arquivo é gerado. Prova a proteção contra
  duplicidade depois de um crash real.

## Estrutura de arquivos locais (nunca commitados — ver `.gitignore`)

```
config.json          — servidor, device ID, token, nome do dispositivo
data/
  journal.json        — histórico do que já foi "impresso" (jobId, status,
                         printedAt, ackStatus, orderLabel)
  prints/
    <job-id>.txt       — 1 arquivo por pedido "impresso"
```

## Limitações atuais

- **Não imprime em hardware real** — só gera arquivo de texto local.
- Sem ESC/POS, USB, serial, spooler ou descoberta de impressora.
- Sem interface gráfica — só linha de comando.
- Sem instalador, auto-start ou Windows Service.
- Sem Realtime — só polling simples.
- Sem roteamento de múltiplas impressoras (cozinha/bar).
