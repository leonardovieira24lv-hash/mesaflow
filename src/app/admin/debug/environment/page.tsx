import { requirePageSession } from "@/lib/auth/require-page-session";
import { getDebugEnvironmentInfo } from "@/lib/debug/environment";

export const dynamic = "force-dynamic";

export default async function DebugEnvironmentPage() {
  await requirePageSession();
  const env = getDebugEnvironmentInfo();
  return (
    <div>
      <h1>Debug Tools — Environment</h1>
      <p>Ambiente: {env.ambiente}</p>
      <p>Build: {env.build}</p>
      <p>NEXT_PUBLIC_APP_URL: {env.appUrl}</p>
      <p style={{ color: "#999" }}>Versão dedicada ainda a expandir — hoje mostra o mesmo resumo já exibido no topo de Orders.</p>
    </div>
  );
}
