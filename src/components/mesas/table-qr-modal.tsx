"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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
 */
export function TableQrModal({ open, onClose, tableName, url }: TableQrModalProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

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

  function handleDownload() {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `qr-code-${tableName.toLowerCase().replace(/\s+/g, "-")}.png`;
    link.click();
  }

  return (
    <Modal open={open} onClose={onClose} title={`QR Code — ${tableName}`}>
      <div className="flex flex-col items-center gap-4 pb-6">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL gerado no cliente, não passa pelo otimizador de imagens
          <img src={dataUrl} alt={`QR Code da ${tableName}`} width={240} height={240} />
        ) : (
          <Skeleton className="h-[240px] w-[240px]" />
        )}

        <Button type="button" onClick={handleDownload} disabled={!dataUrl} className="w-full">
          <Download className="h-4 w-4" />
          Baixar QR Code
        </Button>
      </div>
    </Modal>
  );
}
