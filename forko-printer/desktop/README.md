# FORKO Printer Desktop (Windows)

Camada gráfica sobre o motor já existente em `../src` — nenhuma regra de
pareamento, impressão, journal ou retry foi reimplementada aqui. O
processo principal do Electron só importa e chama o mesmo código
compilado (`../dist`, gerado por `npm run build` na raiz de
`forko-printer/`) que a CLI já usa.

## Comandos CLI de desenvolvimento (preservados, sem mudança)

Continuam existindo, sem alteração: `npm run pair`, `npm run start`,
`npm run status`, `npm run journal`, `npm run reset`, `npm run test-print`,
`npm run printers` — todos na raiz de `forko-printer/`, fora desta pasta
`desktop/`.

## Rodar em desenvolvimento

```
cd forko-printer
npm install
npm run build

cd desktop
npm install
npm run start
```

`npm run start` aqui roda `copy-engine.js` primeiro (copia `../dist` pra
`desktop/dist`) e depois abre a janela Electron.

## Gerar o instalador Windows (`FORKO-Printer-Setup.exe`)

**Precisa rodar num Windows de verdade** — este ambiente onde o código foi
escrito não tem Windows nem Electron instalado, então o `.exe` **não foi
gerado nem testado aqui**. O comando exato, rodado numa máquina Windows
com Node instalado:

```
cd forko-printer
npm install
npm run build

cd desktop
npm install
npm run dist
```

O instalador final aparece em `desktop/release/FORKO-Printer-Setup.exe`.

## Ícone

`assets/icon.ico` **ainda não existe** neste pacote — é só um caminho já
referenciado (`main.js`, `package.json`). Sem ele, o app roda normalmente
(o código já trata isso — ícone vazio na bandeja, sem travar nada), mas
fica sem ícone customizado na barra de tarefas/instalador. Adicionar um
`.ico` de verdade em `desktop/assets/icon.ico` antes do build final é
recomendado, mas não bloqueia o funcionamento.

## O que a interface cobre

- **Não vinculado**: código de vinculação, nome do computador, "Conectar".
- **Vinculado**: status (Online/Escolha uma impressora/Não autorizado),
  dropdown de impressoras instaladas, 58/80mm, corte automático,
  "Imprimir teste", área de atividade (log), "Sair".
- Fechar/minimizar a janela mantém o app rodando na bandeja do Windows —
  só "Sair" (na janela ou no menu da bandeja) encerra o processo de
  verdade, parando o polling/heartbeat.
- Depois de escolher a impressora e salvar, o loop de
  claim→imprimir→ACK começa sozinho, sem precisar de mais nenhum clique
  — e continua rodando nas próximas vezes que o app abrir (a config já
  fica salva).

## Limitações desta etapa

- `.exe` não gerado neste ambiente (sem Windows/Electron disponíveis
  aqui) — comandos acima são o caminho real, a rodar numa máquina
  Windows.
- Sem ícone customizado ainda (`assets/icon.ico` ausente).
- Sem auto-start no login do Windows — precisa abrir manualmente (ou
  colocar um atalho na pasta de Inicialização do Windows, fora do
  escopo desta etapa).
- Sem atualização automática do app.
