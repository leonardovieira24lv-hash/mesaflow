import { requirePageSession } from "@/lib/auth/require-page-session";

export const dynamic = "force-dynamic";

export default async function DebugSessionsPage() {
  await requirePageSession();
  return (
    <div>
      <h1>Debug Tools — Sessions</h1>
      <p>
        Ainda não implementada. Planejado: todas as `order_sessions` (abertas e fechadas), com contagem de pedidos
        por sessão e destaque para mesas com mais de uma sessão aberta simultaneamente.
      </p>
    </div>
  );
}
