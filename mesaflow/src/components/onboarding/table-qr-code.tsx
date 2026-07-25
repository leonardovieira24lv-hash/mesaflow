"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Skeleton } from "@/components/ui/skeleton";

interface TableQrCodeProps {
  /** Nome da mesa (ex.: "Mesa 01"), exibido como legenda. */
  tableName: string;
  /** URL completa que o QR Code deve codificar. */
  url: string;
}

/**
 * Renderiza o QR Code de uma mesa a partir da URL de acesso do cliente
 * (`/{slug}/mesa/{qr_token}`, já resolvida pelo chamador). Gerado no cliente
 * via `qrcode` — não existe endpoint de imagem no contrato, só o campo
 * `qr_token` (string); a renderização visual é responsabilidade do front-end.
 */
export function TableQrCode({ tableName, url }: TableQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: 160, margin: 1 }).then((result) => {
      if (!cancelled) setDataUrl(result);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface p-4">
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL gerado no cliente, não passa pelo otimizador de imagens
        <img src={dataUrl} alt={`QR Code da ${tableName}`} width={120} height={120} />
      ) : (
        <Skeleton className="h-[120px] w-[120px]" />
      )}
      <span className="font-mono text-sm font-medium">{tableName}</span>
    </div>
  );
}
