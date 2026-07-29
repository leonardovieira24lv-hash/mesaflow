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

/**
 * "1h20min" / "35min" — duração entre dois instantes, para a tela de
 * Fechamento de Conta ("tempo de permanência" da mesa). Mesmo espírito de
 * `formatRelativeTimeShort` acima (sem `Intl.RelativeTimeFormat`, direto ao
 * ponto), mas sem o prefixo "há" — aqui é uma duração, não "quanto tempo
 * atrás".
 */
export function formatDurationBetween(startIso: string, endIso: string): string {
  const diffMs = Math.max(0, new Date(endIso).getTime() - new Date(startIso).getTime());
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return "menos de 1min";
  if (minutes < 60) return `${minutes}min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours}h` : `${hours}h${remainingMinutes}min`;
}
