import type { Metadata, Viewport } from "next";
import { Poppins, Inter, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import "@/app/globals.css";

// Display — títulos e marca. v3: Poppins Semibold/Bold no lugar da Manrope
// da v2 — mais presença e personalidade, pedido explícito do dono.
const poppinsDisplay = Poppins({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

// Sans — interface e corpo de texto em geral.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Mono — reservada a identificador técnico de verdade (slug do restaurante,
// token do QR Code) — não mudou na v3, porque ali a legibilidade
// monoespaçada tem função real.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

// Numérica — v3: preço, número de mesa, horário. Migrou de monoespaçada
// (v2) para Poppins Bold — mesma família do display, mais "produto de
// consumo", menos "planilha".
const poppinsNumeric = Poppins({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-numeric",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MesaFlow",
    template: "%s · MesaFlow",
  },
  description: "Pedidos via QR Code para restaurantes — cardápio digital e painel em tempo real.",
};

/**
 * Sprint "Cardápio Dark/Premium" (2026-08-09): `viewportFit: "cover"` existe
 * por um motivo específico e único — eliminar a faixa preta que o Chrome no
 * Android desenhava no rodapé do Cardápio Público, por cima da barra do
 * carrinho e do botão "Finalizar pedido" (confirmado por captura de tela
 * real).
 *
 * Sem `viewport-fit=cover`, o navegador RESERVA a faixa da barra de gestos e
 * a pinta com a cor padrão dele (preta), em vez de deixar a página desenhar
 * ali. Como efeito colateral, `env(safe-area-inset-bottom)` — já usado nas
 * barras fixas do Cardápio (`cart-summary-bar.tsx`,
 * `order-summary-bar.tsx`) — resolvia para zero, tornando aquele padding
 * inútil. Com `cover`, o fundo da página se estende por baixo da barra de
 * gestos (fim da faixa preta) e o `env()` passa a devolver a altura real,
 * fazendo os botões respeitarem a área segura de verdade.
 *
 * Declaração puramente estática: não há lógica, dado, hook ou chamada de API
 * envolvida. As telas administrativas não usam barra fixa no rodapé, então
 * não são afetadas visualmente.
 *
 * `themeColor` (2026-08-09, mesmo dia — correção): `viewportFit: "cover"`
 * sozinho não pinta nada — só permite que o conteúdo da página chegue até
 * embaixo da área de gestos. Quem definia a cor daquela faixa continuava
 * sendo o padrão do próprio Chrome (preto), por não haver `theme-color`
 * declarado. `#09090b` = `zinc-950`, a mesma cor de fundo do Cardápio
 * Público — com isso a faixa deixa de aparecer como um bloco preto
 * "estranho" e passa a se confundir com o fundo da própria página.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${poppinsDisplay.variable} ${inter.variable} ${plexMono.variable} ${poppinsNumeric.variable}`}
    >
      <body className="font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
