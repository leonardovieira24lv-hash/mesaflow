import { requirePageSession } from "@/lib/auth/require-page-session";

export const dynamic = "force-dynamic";

export default async function DebugTablesPage() {
  await requirePageSession();
  return (
    <div>
      <h1>Debug Tools — Tables</h1>
      <p>Ainda não implementada. Planejado: estado bruto de cada mesa (status, qr_token, restaurant_id) direto do banco, via service role.</p>
    </div>
  );
}
