-- MesaFlow — Fechamento de Conta com Registro de Pagamento (Sprint
-- "Fechamento de Conta com Registro de Venda", 2026-07-29)
--
-- `order_sessions` já existe desde a migration 0001 e já tem `closed_at`
-- (nunca preenchido até agora — nada no código fechava uma sessão, só
-- liberava a mesa). Uma sessão fechada (`closed_at` preenchido) já é, por
-- si só, o registro persistente de uma venda: os pedidos e itens
-- vinculados a ela (`orders.order_session_id`) nunca são apagados, então
-- histórico de vendas/fechamento de caixa/relatórios/faturamento futuros
-- já têm tudo que precisam via `order_sessions` + `orders` + `order_items`
-- — não é necessária nenhuma tabela nova.
--
-- A única informação que realmente não existe em lugar nenhum do schema é
-- a forma de pagamento. Esta migration adiciona só essa coluna.
alter table public.order_sessions
  add column payment_method text
  check (payment_method in ('pix', 'credit_card', 'debit_card', 'cash'));

comment on column public.order_sessions.payment_method is
  'Forma de pagamento selecionada ao fechar a conta (contrato do fluxo de Fechamento de Conta). Nulo enquanto a sessão está aberta — só é preenchido junto com closed_at.';
