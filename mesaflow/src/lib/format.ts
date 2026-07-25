const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Formata um valor em reais (BRL) — mesmo padrão do formatter já usado em
 * `components/cardapio/products-list.tsx` e `components/dashboard/recent-orders.tsx`,
 * centralizado aqui para a Área do Cliente (Fase 3) não abrir uma terceira
 * instância igual. Os dois arquivos existentes não foram tocados — continuam
 * funcionando como estão; isto é só para código novo.
 */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}
