import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/auth/require-page-session";
import { PrinterSettingsManager } from "@/components/configuracoes/printer-settings-manager";
import { ROUTES } from "@/constants/routes";

export const metadata = { title: "Impressão" };

/**
 * FORKO Printer — Etapa 4 (2026-08-24). Mesmo padrão de
 * `operacao/page.tsx`/`equipe/page.tsx` — `requirePageSession()` +
 * checagem de `role`, reforçando (não substituindo) a proteção real,
 * que é o `requireOwner()` das rotas de API.
 *
 * Sem busca de dado no servidor — a lista de dispositivos precisa
 * atualizar periodicamente (online/offline sem Realtime, via polling
 * leve), então nasce sempre do lado do cliente
 * (`PrinterSettingsManager`), com skeleton no 1º carregamento.
 */
export default async function ImpressaoPage() {
  const { profile } = await requirePageSession();
  if (profile.role !== "owner") {
    redirect(ROUTES.dashboard);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold">Impressão</h1>
        <p className="text-sm text-muted-foreground">
          Conecte o computador do restaurante ao FORKO para imprimir pedidos automaticamente.
        </p>
      </div>

      <PrinterSettingsManager />
    </div>
  );
}
