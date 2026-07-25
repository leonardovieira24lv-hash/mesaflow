/**
 * Shell da Área do Cliente (pública, sem login). Layout deliberadamente
 * minimalista e mobile-first — é acessado escaneando um QR Code na mesa.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-screen max-w-md">{children}</div>;
}
