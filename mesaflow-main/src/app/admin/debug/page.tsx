import { requirePageSession } from "@/lib/auth/require-page-session";

export const dynamic = "force-dynamic";

export default async function DebugToolsIndexPage() {
  await requirePageSession();

  return (
    <div>
      <h1>Debug Tools</h1>
      <p>Ferramentas internas de diagnóstico do MesaFlow — todas somente leitura.</p>
      <ul>
        <li>
          <strong>Orders</strong> — últimos 20 pedidos, cruzados com mesa/sessão/restaurante, com destaque automático
          de inconsistências.
        </li>
        <li>
          <em>Tables, Sessions, Restaurant, Environment, API</em> — ainda não implementadas (estrutura de rotas já
          preparada em <code>src/app/admin/debug/</code>).
        </li>
      </ul>
    </div>
  );
}
