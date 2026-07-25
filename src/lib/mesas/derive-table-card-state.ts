import type { TableStatus } from "@/types/domain";

export type TableCardTone = "neutral" | "success" | "warning" | "info" | "destructive" | "muted";

/**
 * Um alerta pontual de mesa (chamar garçom, pedir a conta). Não existe
 * backend para isso hoje — ver `docs/table-events-roadmap.md` para o que
 * falta (tabela `table_events`, endpoints, canal Realtime). Este tipo e a
 * lista `alerts` abaixo já modelam o formato que esse dado vai ter quando
 * existir, para que ligar o backend real não exija tocar em
 * `deriveTableCardState` nem no `TableCard` — só passar uma lista não-vazia
 * onde hoje sempre chega `[]`.
 */
export interface TableCardAlert {
  type: "waiter_call" | "bill_request";
  createdAt: string;
}

export interface TableOperationalData {
  totalAmount: number;
  itemCount: number;
  lastOrderAt: string | null;
  hasPendingOrder: boolean;
}

export interface TableCardState {
  tone: TableCardTone;
  label: string;
  /**
   * Sinaliza que o tile representa algo que pede atenção imediata (pedido
   * novo, garçom chamado, conta pedida). Não dispara mais uma pulsação
   * contínua — o flash de transição em `TablesManager`/`TableDrawer` já
   * acontece para qualquer mudança de tom, urgente ou não. Campo mantido
   * disponível para uso futuro (ex.: destaque persistente na ordenação da
   * grade) sem precisar mudar a assinatura de `deriveTableCardState`.
   */
  pulse: boolean;
}

/**
 * Decide a cor/label do tile de mesa por prioridade — o operador precisa
 * bater o olho e entender em segundos, sem ler texto (Painel de Mesas,
 * pedido do dono: "Centro de Operações").
 *
 * Prioridade: conta solicitada > garçom chamado > pedido novo > manutenção
 * > livre > atendimento normal. Os dois primeiros nunca disparam hoje
 * (`alerts` sempre chega `[]` — sem backend, ver acima), mas a ordem já
 * está certa para quando existirem.
 *
 * Mapeamento de cor combinado com o dono nesta sprint (diferente do
 * primeiro redesign de Mesas, que usava verde para "livre"): cinza = livre,
 * verde = ocupada sem pendência, amarelo = pedido novo chegou.
 */
export function deriveTableCardState(
  status: TableStatus,
  data: TableOperationalData | null,
  alerts: TableCardAlert[],
): TableCardState {
  if (alerts.some((a) => a.type === "bill_request")) {
    return { tone: "destructive", label: "Conta solicitada", pulse: true };
  }

  if (alerts.some((a) => a.type === "waiter_call")) {
    return { tone: "info", label: "Chamando garçom", pulse: true };
  }

  if (status === "manutencao") {
    return { tone: "muted", label: "Manutenção", pulse: false };
  }

  if (status === "livre") {
    return { tone: "neutral", label: "Livre", pulse: false };
  }

  if (data?.hasPendingOrder) {
    return { tone: "warning", label: "Novo pedido", pulse: true };
  }

  return { tone: "success", label: "Atendimento normal", pulse: false };
}

/**
 * Tons sólidos para o tile inteiro (grade de Mesas e cabeçalho do Drawer).
 * Deliberadamente mais dessaturados que os tokens semânticos globais
 * (`--success`/`--warning`/`--info`/`--destructive`, usados em Badge/Toast/
 * Alert/Dashboard) — em badges pequenos a cor vibrante ajuda a chamar
 * atenção, mas preenchendo um card inteiro o mesmo tom fica com aspecto de
 * alerta/erro em vez de software profissional. Valores isolados aqui (não
 * tokens globais) para não afetar nenhum outro componente do design system.
 */
export const TABLE_CARD_TONE_CLASSES: Record<TableCardTone, string> = {
  neutral: "border-border bg-surface",
  success: "border-transparent bg-[hsl(152_38%_31%)] text-white",
  warning: "border-transparent bg-[hsl(36_58%_41%)] text-white",
  info: "border-transparent bg-[hsl(217_45%_40%)] text-white",
  destructive: "border-transparent bg-[hsl(358_50%_42%)] text-white",
  muted: "border-border bg-muted/60 opacity-75",
};

/** Tiles com tom preenchido (tudo exceto livre/manutenção) usam texto branco — precisa de uma variante "clara" para os textos secundários (itens, tempo). */
export const TABLE_CARD_FILLED_TONES: readonly TableCardTone[] = ["success", "warning", "info", "destructive"];

export const TABLE_CARD_TONE_DOT_CLASSES: Record<TableCardTone, string> = {
  neutral: "bg-muted-foreground/40",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground/40",
};
