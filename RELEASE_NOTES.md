# Release Notes — MesaFlow

## O que mudou, em uma frase

O painel administrativo do MesaFlow deixou de ser um mosaico de temas (dourado legado + verde novo, coexistindo sem critério) e passou a ser um produto visualmente único, com a tela de Mesas como sua vitrine mais trabalhada.

---

## Para quem usa o sistema no dia a dia

### Painel de Mesas
- Ao abrir a tela, a primeira coisa que aparece agora é **se existe algo que precisa da sua atenção agora** (pedido esperando ir pra cozinha, garçom chamado, conta pedida) — e só isso, quando existe. Quando não há nada pendente, esse bloco simplesmente não aparece; a ausência dele já é a resposta.
- Os números de "mesas livres/ocupadas/manutenção/pedidos em aberto" vêm logo depois, com destaque. "Valor em aberto" e "ticket médio" continuam disponíveis, só numa linha mais discreta — são informação de contexto, não decisão do momento.
- Cada mesa é agora um bloco sólido e elegante — nunca mais "só uma borda colorida". O número da mesa domina o card; o status fica pequeno e discreto logo abaixo. Mesas que realmente precisam de ação (pedido novo, conta pedida) se destacam mais que as demais, mesmo sem precisar passar o mouse — pensado pra funcionar bem no celular.
- Os botões de QR Code/Editar/Excluir agora formam um grupo único e sempre visível (nunca escondido, mesmo no celular, onde não existe "passar o mouse").
- O botão "Ver mesa" deixou de parecer um botão solto — agora é uma faixa que nasce do próprio card.
- Os filtros de status viraram um seletor único (visual mais limpo, no estilo de produtos como Linear).

### Cores — o que cada uma significa agora, em qualquer tela do Admin
- **Verde**: ação principal, mesa ocupada operando normalmente, ou "chamando garçom".
- **Laranja**: novo pedido / atenção.
- **Vermelho**: manutenção ou urgência (conta solicitada).
- **Grafite**: neutro.
- Nunca mais dourado, nunca azul como segunda cor de marca — essa mistura de cores era a causa raiz de cada tela "parecer um produto diferente".

### Acessibilidade
- Todo botão, campo e link do painel administrativo agora mostra um anel de foco visível ao navegar por teclado (Tab) — antes, a maioria não mostrava nada.
- Erros em notificações agora interrompem a leitura de um leitor de tela; avisos e confirmações continuam discretos, como antes.

---

## Para quem mantém o código

- **Nenhuma regra de negócio, hook, query, mutation, estado ou tipagem foi alterada** em nenhuma etapa desta série — tudo foi migração/redesign de `className`/JSX.
- Todo o Admin agora usa uma única fundação de tokens (`ds2-*`, grafite + verde) — os tokens legados (`--chrome-*`, `.btn-primary-surface`, tema dourado) deixaram de ter consumidor real, exceto o Cardápio do cliente (público, propositalmente fora deste ciclo).
- `order_session.closed_at` continua sendo a única fonte de verdade para "esta mesa tem uma comanda aberta" — nenhuma mudança nessa regra em toda a série.
- Auditoria final: todos os arquivos `.ts`/`.tsx` do projeto com chaves balanceadas, nenhum arquivo vazio, nenhum import ou variável sem uso nos arquivos revisados, tags JSX balanceadas (verificado manualmente, incluindo falsos positivos de comentários com `<Button>`/`<dialog>` escritos como texto). Um bug real foi encontrado e corrigido durante esta auditoria: um log de debug interno mostrava uma versão desatualizada do estilo do card, de antes dos últimos redesigns — corrigido para refletir o estilo real.

## O que ainda não foi feito (registrado, não esquecido)
- KPIs da tela de Caixa ainda usam o formato antigo de card (quadradinho colorido atrás do ícone) — migração de cor já feita, reestruturação visual fica para uma versão futura.
- Cardápio do cliente, Login e Onboarding continuam no tema visual original — fora do escopo de toda esta série, por decisão explícita.
