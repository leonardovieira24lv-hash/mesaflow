# MesaFlow — Auditoria de Design e Plano de Redesign

Análise das telas atuais como produto SaaS de restaurante. Nenhum código foi alterado — isto é só o diagnóstico e o plano.

## Achado estrutural mais importante

O projeto já tem uma **Design System 2.0** construída (`app/globals.css`, classe `.ds2-dark`, tokens `--ds2-*`) — grafite quase preto + verde como única cor de marca, escala tipográfica de 6 níveis, 3 raios nomeados. Ela existe **só** na vitrine interna `/design-system` — nenhuma tela de produto a usa ainda. Qualquer plano de redesign deveria **adotar essa fundação, não competir com ela** — o trabalho caro (decidir paleta, radius, sombras) já foi feito; falta rolar tela por tela.

Isso muda a natureza deste plano: não é "inventar uma direção visual nova", é "migrar cada tela pra fundação que já existe, na ordem certa".

---

## Panorama por tela

### 1. Painel de Mesas (`tables-manager.tsx` / `table-drawer.tsx`) — o mais urgente

Esta é a tela mais usada (fica aberta o turno inteiro) e a que mais acumulou camadas ao longo de várias sprints incrementais, sem nunca ter um passo de consolidação:

- **Excesso de informação/estímulo**: cada card hoje pode empilhar simultaneamente — cor de fundo (tom), ícone decorativo de fundo, badge de status com dot, badge "N NOVOS" com `animate-pulse`, animação de escala/sombra do tile inteiro (`animate-new-order-alert`), flash de transição (`animate-status-flash`), valor, contagem de pedidos/itens, horário do último pedido, 3 ícones de ação no canto. Cada peça foi uma boa decisão isolada; juntas, competem por atenção entre si — o efeito "impossível não perceber pedido novo" (pedido explícito de sprint recente) briga com "hierarquia visual limpa" porque nada mais no card tem prioridade menor.
- **Hierarquia**: não há uma clara distinção entre "isto muda a cada segundo" (status, badge) e "isto é fixo" (nome da mesa) — tudo tem o mesmo peso visual.
- **Cores**: tons de card (`TABLE_CARD_TONE_CLASSES`) e o badge de pedido novo usam uma cor fixa em HSL literal (`hsl(16 78% 46%)`) em vez de token do tema — não vai herdar a paleta DS2 quando a migração acontecer, é retrabalho garantido.
- **Consistência**: o Drawer duplica boa parte da lógica visual do card (badge, tom) só que num layout diferente — dois lugares pra manter a mesma linguagem visual em sincronia manual.

### 2. Área do Cliente (Cardápio/Comanda) — mais madura, mas com uma peça órfã

Já passou por dois redesigns reais (`menu-item-card.tsx`, "Redesign Completo do Cardápio Público"; e a tela de comanda, sprint recente). É a tela com melhor acabamento hoje. Dois problemas pontuais:
- `order-status-timeline.tsx` ficou sem nenhum uso depois do redesign da tela de comanda — componente morto, com CSS/lógica própria que ninguém mais chama.
- A comanda nova introduziu um segundo padrão de "resumo em card" (total/pedidos/itens) que não existe em nenhum outro lugar do cardápio — vale formalizar como componente reutilizável antes que uma próxima tela reinvente de novo.

### 3. Dashboard, Caixa, Pedidos, Cardápio (admin) — utilitárias, nunca "desenhadas"

Estrutura funcional e limpa (Server Components com Suspense bem divididos, no caso do Dashboard), mas visualmente são as telas mais "genéricas" do sistema — nenhuma delas tem uma identidade de marca tão forte quanto o Cardápio Público já tem. Tipografia e espaçamento seguem o sistema atual (`--primary` etc.), então herdam qualquer inconsistência dele, mas não têm problema próprio grave — são candidatas naturais a ganhar a fundação DS2 depois das Mesas.

### 4. Onboarding / Login — não avaliado a fundo nesta rodada

Fluxo simples, baixo risco, baixo tráfego comparado às telas operacionais — prioridade naturalmente mais baixa.

---

## Plano priorizado

| # | Tela/Item | Problema principal | Esforço | Impacto |
|---|---|---|---|---|
| 1 | **Painel de Mesas** — consolidar hierarquia visual | Camadas de badge/animação empilhadas sem hierarquia entre si | Médio | Altíssimo (tela mais usada) |
| 2 | **Migrar cores "mágicas" pra tokens** (badge de pedido novo, tons de card) | `hsl(...)` literal fora do tema — trava a migração pro DS2 | Baixo | Alto (desbloqueia o resto) |
| 3 | **Adotar `.ds2-dark` no Painel de Mesas** | Fundação pronta, zero telas usando | Médio-Alto | Alto |
| 4 | **Componentizar o "card de resumo"** da Comanda | Padrão novo, ainda não reutilizável | Baixo | Médio (evita divergência futura) |
| 5 | **Remover `order-status-timeline.tsx`** (órfão) | Código morto | Baixo | Baixo (limpeza) |
| 6 | **Adotar DS2 em Dashboard/Caixa/Pedidos** | Visual genérico, sem problema grave | Alto | Médio |
| 7 | **Onboarding/Login** | Não avaliado a fundo | — | Baixo |

**Por que essa ordem:** Mesas é onde qualquer ruído visual custa mais caro (uso contínuo, decisão em segundos); tokens de cor são o pré-requisito barato que destrava toda migração futura pro DS2; só depois faz sentido gastar o esforço maior de rolar a fundação nova tela por tela, começando por onde ela mais compensa.

Nenhuma alteração de código foi feita — este documento é só o diagnóstico e a priorização, para validação antes de qualquer implementação.
