"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Printer, Monitor } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * Etapa 7 (2026-08-25) — link estável do GitHub que sempre aponta pro
 * asset da release MAIS RECENTE, sem precisar saber o número da versão
 * (nem hardcode-lo em lugar nenhum): funciona porque o nome do arquivo
 * (`FORKO-Printer-Setup.exe`) é fixo entre versões — ver
 * `.github/workflows/release-forko-printer.yml`. Sem
 * `NEXT_PUBLIC_FORKO_PRINTER_GITHUB_REPO` configurada, fica `null` — o
 * botão mostra estado desabilitado em vez de um link quebrado (pedido
 * explícito: "não colocar link quebrado").
 */
const FORKO_PRINTER_DOWNLOAD_URL = process.env.NEXT_PUBLIC_FORKO_PRINTER_GITHUB_REPO
  ? `https://github.com/${process.env.NEXT_PUBLIC_FORKO_PRINTER_GITHUB_REPO}/releases/latest/download/FORKO-Printer-Setup.exe`
  : null;

/**
 * FORKO Printer — Etapa 4 (2026-08-24). Interface REAL de produto (pedido
 * explícito: "não uma tela técnica de desenvolvedor") — o dono do
 * restaurante nunca vê token, hash, IDs técnicos ou `claimed_by`, só o
 * que importa pra ele: tem computador conectado? está online? como
 * conectar um novo?
 *
 * Sem Realtime (pedido explícito) — atualiza via polling leve (a cada
 * 20s) enquanto a tela estiver aberta. `ONLINE`/`OFFLINE` calculado no
 * cliente a partir de `lastSeenAt` (janela de 90s, seguindo a sugestão
 * do pedido — folga suficiente pro heartbeat de ~30s do agente não
 * gerar falso "offline" por atraso de 1 ciclo).
 */

interface PrinterDevice {
  id: string;
  name: string;
  lastSeenAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

const ONLINE_WINDOW_MS = 90_000;
const DEVICES_POLL_MS = 20_000;

function isOnline(device: PrinterDevice): boolean {
  if (!device.lastSeenAt) return false;
  return Date.now() - new Date(device.lastSeenAt).getTime() <= ONLINE_WINDOW_MS;
}

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "Nunca";
  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  return `há ${diffHours}h`;
}

export function PrinterSettingsManager() {
  const [devices, setDevices] = useState<PrinterDevice[] | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<PrinterDevice | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const fetchDevices = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/printer/devices");
      const body = await response.json();
      if (!response.ok) return;
      setDevices(body.data as PrinterDevice[]);
    } catch {
      // Falha de polling silenciosa de propósito — não empilha toast a
      // cada 20s por causa de uma rede instável; a tela só continua
      // mostrando o último estado conhecido.
    }
  }, []);

  useEffect(() => {
    void fetchDevices();
    const interval = setInterval(() => void fetchDevices(), DEVICES_POLL_MS);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  const activeDevices = useMemo(() => (devices ?? []).filter((d) => d.revokedAt === null), [devices]);

  async function handleRevoke() {
    if (!revokeTarget) return;
    setIsRevoking(true);
    try {
      const response = await fetch(`/api/v1/printer/devices/${revokeTarget.id}`, { method: "DELETE" });
      if (!response.ok) {
        toast.error("Não foi possível desconectar", "Tente novamente em instantes.");
        return;
      }
      toast.success("Computador desconectado.");
      setRevokeTarget(null);
      await fetchDevices();
    } finally {
      setIsRevoking(false);
    }
  }

  if (devices === null) {
    return <Skeleton className="h-40 w-full rounded-ds2-lg" />;
  }

  return (
    <>
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-ds2-md bg-ds2-primary/10 text-ds2-primary">
            <Printer className="h-5 w-5" />
          </span>
          <div className="flex flex-col">
            <span className="font-semibold text-ds2-foreground">FORKO Printer</span>
            <span className="text-xs text-ds2-foreground-muted">
              {activeDevices.length === 0 ? "Não conectado" : `${activeDevices.length} computador(es) conectado(s)`}
            </span>
          </div>
        </div>

        {activeDevices.length === 0 ? (
          <EmptyState
            icon={Monitor}
            title="Nenhum computador conectado"
            description="Instale o FORKO Printer no computador ligado à sua impressora e faça o pareamento."
            action={<Button onClick={() => setConnectOpen(true)}>Conectar computador</Button>}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {activeDevices.map((device) => {
              const online = isOnline(device);
              return (
                <div
                  key={device.id}
                  className="flex flex-col gap-3 rounded-ds2-md border border-ds2-border p-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Monitor className="h-4 w-4 shrink-0 text-ds2-foreground-muted" aria-hidden />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-ds2-foreground">{device.name}</span>
                      <span className="flex items-center gap-1.5 text-xs text-ds2-foreground-muted">
                        <Badge variant={online ? "success" : "muted"}>{online ? "● Online" : "○ Offline"}</Badge>
                        <span>· última comunicação: {formatLastSeen(device.lastSeenAt)}</span>
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 self-start sm:self-auto"
                    onClick={() => setRevokeTarget(device)}
                  >
                    Desconectar
                  </Button>
                </div>
              );
            })}
            <Button variant="outline" onClick={() => setConnectOpen(true)} className="self-start">
              Conectar outro computador
            </Button>
          </div>
        )}
      </Card>

      <ConnectComputerModal open={connectOpen} onClose={() => setConnectOpen(false)} />

      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title={`Desconectar "${revokeTarget?.name ?? ""}"?`}
        description="Este computador deixará de receber pedidos para impressão. Para conectá-lo novamente será necessário fazer um novo pareamento."
        confirmLabel="Desconectar"
        variant="destructive"
        onConfirm={handleRevoke}
        isConfirming={isRevoking}
      />
    </>
  );
}

// ── Modal "Conectar computador" — 2 passos ─────────────────────────────

interface ConnectComputerModalProps {
  open: boolean;
  onClose: () => void;
}

function ConnectComputerModal({ open, onClose }: ConnectComputerModalProps) {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!open) {
      // Reseta ao fechar — reabrir sempre começa do zero, código antigo
      // nunca reaparece "fantasma".
      setCode(null);
      setExpiresAt(null);
    }
  }, [open]);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  async function handleGenerateCode() {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/v1/printer/pairing-code", { method: "POST" });
      const body = await response.json();
      if (!response.ok) {
        toast.error("Não foi possível gerar o código", body.error?.message);
        return;
      }
      setCode(body.data.code as string);
      setExpiresAt(body.data.expiresAt as string);
      toast.success("Código de conexão gerado.");
    } finally {
      setIsGenerating(false);
    }
  }

  const expired = code !== null && secondsLeft === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Conectar computador"
      description="Passo a passo pra conectar o FORKO Printer."
    >
      <div className="flex flex-col gap-5">
        {/* Visão geral do fluxo completo (Etapa 7, pedido explícito) —
            os passos 3-7 acontecem fora deste modal (no aplicativo
            instalado e na tela principal desta página), mas listar
            todos aqui ajuda o dono a entender o caminho inteiro antes
            de começar. */}
        <ol className="flex flex-col gap-1 rounded-ds2-md bg-ds2-surface-hover/40 p-3 text-xs text-ds2-foreground-muted">
          <li>1. Baixe e instale o FORKO Printer</li>
          <li>2. Abra o aplicativo</li>
          <li>3. Gere o código de conexão (aqui embaixo)</li>
          <li>4. Digite o código no aplicativo</li>
          <li>5. Escolha a impressora</li>
          <li>6. Imprima um teste</li>
          <li>7. Pronto</li>
        </ol>

        <div className="flex flex-col gap-2 rounded-ds2-md border border-ds2-border p-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-ds2-foreground-muted">Passo 1</span>
          <span className="font-medium text-ds2-foreground">Instale o FORKO Printer</span>
          <p className="text-sm text-ds2-foreground-muted">
            Abra o FORKO Printer no computador que será usado para impressão.
          </p>
          {FORKO_PRINTER_DOWNLOAD_URL ? (
            <a
              href={FORKO_PRINTER_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              download
              className={cn(buttonVariants("outline", "md"), "w-fit")}
            >
              Baixar FORKO Printer para Windows
            </a>
          ) : (
            <Button variant="outline" disabled className="w-fit">
              Baixar FORKO Printer (download não configurado)
            </Button>
          )}
          <span className="text-xs text-ds2-foreground-muted">Windows 10/11 · 64 bits</span>
        </div>

        <div className="flex flex-col gap-3 rounded-ds2-md border border-ds2-border p-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-ds2-foreground-muted">Passo 2</span>
          <span className="font-medium text-ds2-foreground">Gerar código de conexão</span>

          {!code || expired ? (
            <Button onClick={handleGenerateCode} isLoading={isGenerating} className="w-fit">
              {expired ? "Gerar novo código" : "Gerar código"}
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-ds2-md bg-ds2-primary/5 py-5">
              <span className="font-numeric text-3xl font-bold tracking-[0.3em] text-ds2-foreground">{code}</span>
              <p className="text-sm text-ds2-foreground-muted">Digite este código no FORKO Printer.</p>
              <p className="text-xs text-ds2-foreground-muted">
                Este código expira em {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}.
              </p>
            </div>
          )}

          {expired && <p className="text-xs text-ds2-danger">Código expirado.</p>}
        </div>

        <p className="text-xs text-ds2-foreground-muted">
          Assim que o pareamento terminar no computador, feche esta janela — o dispositivo aparece na lista
          automaticamente.
        </p>
      </div>
    </Modal>
  );
}
