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

/**
 * "há 3 min" / "há 1h20" — usado no Painel de Mesas para "tempo desde o
 * último pedido". Deliberadamente simples (sem `Intl.RelativeTimeFormat`,
 * que devolveria "em 3 minutos"/"há 3 minutos" mais verboso do que cabe num
 * tile de mesa) — o operador precisa ler isso em menos de um segundo.
 */
export function formatRelativeTimeShort(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));

  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `há ${hours}h` : `há ${hours}h${remainingMinutes}`;
}
