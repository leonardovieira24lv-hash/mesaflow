/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Sprint 10 (auditoria): `typedRoutes` estava sob `experimental` — nesta
  // versão do Next (15.5.21) já é uma opção estável de topo; a chave antiga
  // ainda funcionava, mas emitia aviso no build.
  typedRoutes: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        // Supabase Storage — ajustar para o hostname real do projeto em produção.
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
