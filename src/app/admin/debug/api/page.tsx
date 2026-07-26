import { requirePageSession } from "@/lib/auth/require-page-session";

export const dynamic = "force-dynamic";

export default async function DebugApiPage() {
  await requirePageSession();
  return (
    <div>
      <h1>Debug Tools — API</h1>
      <p>Ainda não implementada. Planejado: testar endpoints da API direto pelo celular, sem precisar de um cliente HTTP externo.</p>
    </div>
  );
}
