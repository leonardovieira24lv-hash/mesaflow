import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import "@/app/globals.css";

// Display — usada com moderação em títulos e no logotipo (peso editorial,
// remete à tipografia de menu impresso).
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

// Sans — interface e corpo de texto em geral.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Mono — reservada para dado: número de mesa, número de pedido, preço,
// horário. Reforça a metáfora da comanda impressa.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
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
    <html lang="pt-BR" className={`${fraunces.variable} ${inter.variable} ${plexMono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
