"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { CheckSquare, Download, Printer, Square } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * Impressão em LOTE de QR Codes das mesas (2026-08-17/18) — spec detalhada
 * do dono, pensada pro caso de 15-20+ mesas: a impressão individual
 * (`TableQrModal`) gera 1 folha A4 por mesa, inviável em escala. Este
 * modal é uma peça NOVA, adicional — não altera nada da geração de QR,
 * do `qr_token` ou da impressão individual, que continuam exatamente
 * como estavam.
 *
 * Reaproveita de propósito: mesma lib (`qrcode`), mesma função de URL
 * (`tableUrl`, resolvida pronta por mesa via prop — não reimplementada
 * aqui), mesmo mecanismo de impressão por CSS (`@media print` em
 * `globals.css`, só um novo id `#print-batch-qr` ao lado do que já
 * existe). O único jeito genuinamente novo é o PDF (`jspdf`, dependência
 * nova do projeto) — pedido do dono pensando no cliente final que leva
 * numa gráfica pra fazer adesivo/plastificar, onde `window.print()`
 * sozinho não bastava.
 *
 * Cálculo de layout: o dono não quer escolher "quantos por folha" — só
 * o TAMANHO do QR (Pequeno/Médio/Grande). A quantidade de colunas/linhas
 * por A4 é sempre derivada do tamanho escolhido, nunca fixa.
 */

interface BatchTable {
  id: string;
  name: string;
  url: string;
}

interface BatchQrPrintModalProps {
  open: boolean;
  onClose: () => void;
  tables: BatchTable[];
}

type SizeKey = "pequeno" | "medio" | "grande";

const SIZES: Record<SizeKey, { label: string; qrCm: number; cardWCm: number; cardHCm: number }> = {
  pequeno: { label: "Pequeno", qrCm: 4, cardWCm: 5, cardHCm: 7.6 },
  medio: { label: "Médio", qrCm: 5, cardWCm: 6, cardHCm: 8.8 },
  grande: { label: "Grande", qrCm: 6, cardWCm: 7, cardHCm: 10 },
};

// A4 (21×29,7cm) com 1cm de margem de página em cada lado.
const PAGE_MARGIN_CM = 1;
const PAGE_USABLE_W_CM = 21 - PAGE_MARGIN_CM * 2;
const PAGE_USABLE_H_CM = 29.7 - PAGE_MARGIN_CM * 2;

const LOGO_ICON_SRC = "/logo-forko-icon.png";

/** Converte a logo (arquivo estático em `public/`) numa dataURL — precisa
 *  disso pra poder embutir no PDF (`jsPDF.addImage` não aceita um caminho
 *  de URL comum, só dataURL/base64). Pro `window.print()`, isso nem é
 *  necessário — um `<img src="/logo-forko-icon.png">` normal já funciona
 *  na view de impressão, sem precisar dessa conversão. */
function loadImageAsDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("no-canvas-context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("logo-load-failed"));
    img.src = src;
  });
}

export function BatchQrPrintModal({ open, onClose, tables }: BatchQrPrintModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [size, setSize] = useState<SizeKey>("medio");
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Ao abrir, começa com todas as mesas selecionadas — "selecionar todas"
  // é o caso mais comum (imprimir o lote inteiro de uma vez).
  useEffect(() => {
    if (open) setSelected(new Set(tables.map((t) => t.id)));
  }, [open, tables]);

  const cfg = SIZES[size];
  const cols = Math.max(1, Math.floor(PAGE_USABLE_W_CM / cfg.cardWCm));
  const rows = Math.max(1, Math.floor(PAGE_USABLE_H_CM / cfg.cardHCm));
  const perPage = cols * rows;

  const selectedTables = useMemo(() => tables.filter((t) => selected.has(t.id)), [tables, selected]);
  const pages = useMemo(() => {
    const chunks: BatchTable[][] = [];
    for (let i = 0; i < selectedTables.length; i += perPage) {
      chunks.push(selectedTables.slice(i, i + perPage));
    }
    return chunks;
  }, [selectedTables, perPage]);

  // Gera o QR (dataURL) de cada mesa selecionada que ainda não tem um
  // gerado — em resolução mais alta que o modal individual (que usa
  // 320px, pensado pra tela; aqui o destino é papel, então 600px dá
  // nitidez de sobra mesmo no tamanho "Grande"). `margin: 2` (unidade da
  // própria lib, em "módulos" do QR, não pixels) garante uma quiet zone
  // mínima já na imagem — o respiro visual adicional vem do padding do
  // cartão em si, na hora de desenhar.
  useEffect(() => {
    if (!open || selectedTables.length === 0) return;
    const missing = selectedTables.filter((t) => !qrDataUrls[t.id]);
    if (missing.length === 0) return;

    let cancelled = false;
    setIsGenerating(true);
    Promise.all(
      missing.map(async (t) => {
        const dataUrl = await QRCode.toDataURL(t.url, { width: 600, margin: 2 });
        return [t.id, dataUrl] as const;
      }),
    )
      .then((entries) => {
        if (cancelled) return;
        setQrDataUrls((prev) => {
          const next = { ...prev };
          for (const [id, dataUrl] of entries) next[id] = dataUrl;
          return next;
        });
      })
      .finally(() => {
        if (!cancelled) setIsGenerating(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `qrDataUrls` de propósito fora das deps: só dispara quando `selectedTables`/`open` mudam, não a cada QR que chega (senão reroda infinito).
  }, [open, selectedTables]);

  function toggleTable(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === tables.length ? new Set() : new Set(tables.map((t) => t.id))));
  }

  function handlePrint() {
    if (selectedTables.length === 0) return;
    window.print();
  }

  async function handleDownloadPdf() {
    if (selectedTables.length === 0) return;
    setIsExportingPdf(true);
    try {
      const logoDataUrl = await loadImageAsDataUrl(LOGO_ICON_SRC).catch(() => null);
      const doc = new jsPDF({ unit: "cm", format: "a4" });
      const logoWCm = 0.55;
      const logoHCm = logoDataUrl ? (logoWCm * 1) / 1.29 : 0; // proporção real do arquivo (~1.29:1)

      pages.forEach((pageTables, pageIndex) => {
        if (pageIndex > 0) doc.addPage();

        pageTables.forEach((table, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = PAGE_MARGIN_CM + col * cfg.cardWCm;
          const y = PAGE_MARGIN_CM + row * cfg.cardHCm;

          // Faixa vermelha do topo — "MESA XX"
          const headerHCm = 1.3;
          doc.setFillColor(230, 30, 40);
          doc.rect(x + 0.15, y + 0.15, cfg.cardWCm - 0.3, headerHCm, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(16);
          doc.text(`MESA ${table.name}`, x + cfg.cardWCm / 2, y + 0.15 + headerHCm / 2 + 0.15, {
            align: "center",
          });

          // QR — centralizado, com respiro (quiet zone visual) ao redor.
          const qrDataUrl = qrDataUrls[table.id];
          const qrX = x + (cfg.cardWCm - cfg.qrCm) / 2;
          const qrY = y + 0.15 + headerHCm + 0.35;
          if (qrDataUrl) {
            doc.addImage(qrDataUrl, "PNG", qrX, qrY, cfg.qrCm, cfg.qrCm);
          }

          // Texto de apoio
          doc.setTextColor(90, 90, 95);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          const textY = qrY + cfg.qrCm + 0.45;
          doc.text("Aponte a câmera para", x + cfg.cardWCm / 2, textY, { align: "center" });
          doc.text("fazer seu pedido", x + cfg.cardWCm / 2, textY + 0.38, { align: "center" });

          // Assinatura — logo oficial (ícone real, não texto desenhado).
          const signY = textY + 0.75;
          if (logoDataUrl) {
            doc.addImage(
              logoDataUrl,
              "PNG",
              x + cfg.cardWCm / 2 - logoWCm / 2 - 0.45,
              signY - logoHCm / 2,
              logoWCm,
              logoHCm,
            );
          }
          doc.setTextColor(40, 40, 40);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text("FORKO", x + cfg.cardWCm / 2 + 0.15, signY + 0.1, { align: "left" });

          // Guia de corte (linha pontilhada) — só visual, não é conteúdo.
          doc.setDrawColor(210, 210, 213);
          doc.setLineDashPattern([0.1, 0.1], 0);
          doc.rect(x + 0.05, y + 0.05, cfg.cardWCm - 0.1, cfg.cardHCm - 0.1);
        });
      });

      doc.save("qr-codes-mesas-forko.pdf");
    } catch {
      toast.error("Não foi possível gerar o PDF", "Tente novamente em instantes.");
    } finally {
      setIsExportingPdf(false);
    }
  }

  const allSelected = selected.size === tables.length && tables.length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Imprimir QR Codes"
      description="Selecione as mesas e o tamanho — o layout na folha A4 é calculado automaticamente."
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-5 pb-2">
        {/* Seleção de mesas */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-ds2-foreground-muted">Mesas</span>
            <button
              type="button"
              onClick={toggleAll}
              className="flex items-center gap-1.5 text-xs font-medium text-ds2-primary hover:underline"
            >
              {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
              {allSelected ? "Limpar seleção" : "Selecionar todas"}
            </button>
          </div>
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-7">
            {tables.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTable(t.id)}
                aria-pressed={selected.has(t.id)}
                className={cn(
                  "rounded-ds2-sm border py-1.5 text-xs font-semibold transition-colors",
                  selected.has(t.id)
                    ? "border-ds2-primary bg-ds2-primary/10 text-ds2-primary"
                    : "border-ds2-border text-ds2-foreground-muted",
                )}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tamanho */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ds2-foreground-muted">
            Tamanho do QR Code
          </span>
          <div className="flex gap-2">
            {(Object.entries(SIZES) as [SizeKey, (typeof SIZES)[SizeKey]][]).map(([key, s]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSize(key)}
                aria-pressed={size === key}
                className={cn(
                  "flex-1 rounded-ds2-md border py-2.5 text-center text-sm font-medium transition-colors",
                  size === key
                    ? "border-ds2-primary bg-ds2-primary/10 text-ds2-primary"
                    : "border-ds2-border text-ds2-foreground-muted",
                )}
              >
                {s.label}
                <br />
                <span className="text-xs text-ds2-foreground-muted">~{s.qrCm}×{s.qrCm}cm</span>
              </button>
            ))}
          </div>
        </div>

        {/* Resumo do layout calculado */}
        <p className="text-xs text-ds2-foreground-muted">
          {selectedTables.length === 0
            ? "Nenhuma mesa selecionada."
            : `${selectedTables.length} ${selectedTables.length === 1 ? "mesa" : "mesas"} selecionada${
                selectedTables.length === 1 ? "" : "s"
              } · ${perPage} cartões por folha · ${pages.length} folha${pages.length === 1 ? "" : "s"} A4`}
        </p>

        {/* Prévia — miniatura da 1ª folha */}
        {pages[0] && (
          <div className="flex justify-center rounded-ds2-md border border-ds2-border bg-ds2-surface-hover/30 p-4">
            <div
              className="grid gap-1.5 rounded-sm bg-white p-2 shadow-ds2-sm"
              style={{ width: "160px", aspectRatio: "210 / 297", gridTemplateColumns: `repeat(${cols}, 1fr)` }}
            >
              {pages[0].map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-center overflow-hidden rounded-[2px] border border-zinc-200 bg-zinc-50"
                >
                  <span className="text-[6px] font-bold text-zinc-500">{t.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={handlePrint}
            disabled={selectedTables.length === 0 || isGenerating}
            isLoading={isGenerating}
            className="flex-1"
          >
            <Printer className="h-4 w-4" />
            Imprimir {selectedTables.length > 0 ? `(${selectedTables.length})` : ""}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={selectedTables.length === 0 || isGenerating || isExportingPdf}
            isLoading={isExportingPdf}
            className="flex-1"
          >
            <Download className="h-4 w-4" />
            Baixar PDF
          </Button>
        </div>
      </div>

      {/* View de impressão — só visível em @media print (globals.css).
          Id próprio (`print-batch-qr`), ao lado dos que já existem
          (`print-comanda-drawer`, `print-comanda-qr`) — nunca reutiliza
          o mesmo id de outro componente (lição de bug antigo, ver
          histórico do projeto). Layout em `cm`, replicando o mesmo
          cálculo de colunas/linhas da prévia e do PDF. */}
      <div id="print-batch-qr" className="hidden">
        {pages.map((pageTables, pageIndex) => (
          <div
            key={pageIndex}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, ${cfg.cardWCm}cm)`,
              gap: "0",
              pageBreakAfter: pageIndex < pages.length - 1 ? "always" : "auto",
            }}
          >
            {pageTables.map((t) => (
              <div
                key={t.id}
                style={{
                  width: `${cfg.cardWCm}cm`,
                  height: `${cfg.cardHCm}cm`,
                  border: "1px dashed #d4d4d8",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  boxSizing: "border-box",
                  pageBreakInside: "avoid",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    background: "#e61e28",
                    color: "#fff",
                    textAlign: "center",
                    padding: "0.25cm 0",
                    fontWeight: 700,
                    fontSize: "16pt",
                  }}
                >
                  MESA {t.name}
                </div>
                <div style={{ padding: "0.35cm 0 0.15cm", display: "flex", justifyContent: "center" }}>
                  {qrDataUrls[t.id] && (
                    // eslint-disable-next-line @next/next/no-img-element -- dataURL gerado no cliente, view só de impressão
                    <img
                      src={qrDataUrls[t.id]}
                      alt={`QR Code da mesa ${t.name}`}
                      style={{ width: `${cfg.qrCm}cm`, height: `${cfg.qrCm}cm` }}
                    />
                  )}
                </div>
                <p style={{ margin: "0.1cm 0 0", fontSize: "9pt", color: "#71717a", textAlign: "center" }}>
                  Aponte a câmera para
                  <br />
                  fazer seu pedido
                </p>
                <div style={{ marginTop: "0.25cm", display: "flex", alignItems: "center", gap: "0.1cm" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- asset estático de public/, view só de impressão */}
                  <img src={LOGO_ICON_SRC} alt="" style={{ height: "0.4cm", width: "auto" }} />
                  <span style={{ fontSize: "9pt", fontWeight: 700, color: "#27272a" }}>FORKO</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}
