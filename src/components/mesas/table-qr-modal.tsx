"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, Printer } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";

interface TableQrModalProps {
  open: boolean;
  onClose: () => void;
  tableName: string;
  url: string;
}

/**
 * Exibe (e permite baixar) o QR Code de uma mesa já cadastrada, a partir do
 * `qr_token` existente (contrato 7.1). Não existe endpoint de imagem no
 * contrato — só o campo `qr_token`; a geração visual é sempre
 * responsabilidade do front-end (mesmo padrão de
 * `components/onboarding/table-qr-code.tsx`, mantido como está: este é um
 * componente novo, específico da tela administrativa, para não alterar
 * código fora do escopo desta sprint).
 *
 * "Regenerar" o QR Code nesta tela significa apenas re-renderizar a imagem
 * a partir do `qr_token` já existente — o contrato não prevê (nem esta
 * sprint implementa) a emissão de um novo token para uma mesa já criada,
 * já que isso invalidaria QR Codes já impressos sem nenhuma seção do
 * contrato documentando esse comportamento.
 *
 * "Imprimir" segue o mesmo mecanismo puramente de CSS já usado pelo Drawer
 * (`#print-comanda` + `@media print` em `globals.css`, que só torna esse id
 * visível na folha impressa) — nada novo em `globals.css`, só reaproveita a
 * regra que já existe lá.
 */
export function TableQrModal({ open, onClose, tableName, url }: TableQrModalProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDataUrl(null);
    QRCode.toDataURL(url, { width: 320, margin: 1 }).then((result) => {
      if (!cancelled) setDataUrl(result);
    });
    return () => {
      cancelled = true;
    };
  }, [open, url]);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timeout);
  }, [copied]);

  function handleDownload() {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `qr-code-${tableName.toLowerCase().replace(/\s+/g, "-")}.png`;
    link.click();
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar", "Copie o link manualmente.");
    }
  }

  function handlePrint() {
    if (!dataUrl) return;
    window.print();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Mesa ${tableName}`}
      description="QR Code de acesso ao cardápio digital — imprima e deixe disponível na mesa."
    >
      <div className="flex flex-col items-center gap-5 pb-7">
        {/* Área principal — o QR Code é o protagonista, com bastante respiro. */}
        <div className="flex w-full items-center justify-center rounded-2xl border border-border bg-muted/20 p-6 sm:p-8">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL gerado no cliente, não passa pelo otimizador de imagens
            <img
              src={dataUrl}
              alt={`QR Code de acesso da ${tableName}`}
              width={272}
              height={272}
              className="h-auto w-full max-w-[272px] animate-fade-in rounded-lg"
            />
          ) : (
            <Skeleton className="h-[272px] w-[272px] rounded-lg" />
          )}
        </div>

        {/* Informações auxiliares — discretas, só o que já existe (URL). */}
        <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground" title={url}>
            {url}
          </span>
        </div>

        {/* Área de ações — principal com maior destaque, demais organizadas abaixo. */}
        <div className="flex w-full flex-col gap-2">
          <Button type="button" size="lg" onClick={handleDownload} disabled={!dataUrl} className="w-full">
            <Download className="h-4 w-4" />
            Baixar QR Code
          </Button>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleCopyLink} className="flex-1">
              {copied ? <Check className="h-4 w-4 text-success" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? "Copiado" : "Copiar link"}
            </Button>
            <Button type="button" variant="outline" onClick={handlePrint} disabled={!dataUrl} className="flex-1">
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </div>

          <Button type="button" variant="ghost" onClick={onClose} className="w-full text-muted-foreground">
            Fechar
          </Button>
        </div>
      </div>

      {/* View de impressão — só visível em @media print (globals.css), some do resto da UI. */}
      <div id="print-comanda" className="hidden">
        <div style={{ textAlign: "center" }}>
          <h1>{tableName}</h1>
          {dataUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- data URL gerado no cliente, view só de impressão
            <img src={dataUrl} alt={`QR Code da ${tableName}`} width={320} height={320} />
          )}
          <p>{url}</p>
        </div>
      </div>
    </Modal>
  );
}
