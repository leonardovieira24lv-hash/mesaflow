import type { Metadata } from "next";
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
