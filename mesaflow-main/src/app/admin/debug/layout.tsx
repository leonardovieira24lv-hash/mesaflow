import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = { title: "Debug Tools" };

/**
 * Módulo permanente de ferramentas internas de desenvolvimento
 * (`/admin/debug/*`). Cada sub-rota é uma página de diagnóstico
 * independente — todas somente leitura, nenhuma ação destrutiva. Protegido
 * por `requirePageSession()` em cada página + `/admin/debug` em
 * `middleware.ts`.
 *
 * Ferramentas planejadas (algumas ainda são placeholder "em construção" —
 * ver cada `page.tsx` da sub-rota):
 *   - orders      — pedidos recentes, cruzados com mesa/sessão/restaurante
 *   - tables      — estado bruto das mesas
 *   - sessions    — order_sessions abertas/fechadas
 *   - restaurant  — dados do restaurante e do profile autenticado
 *   - environment — a mesma info de ambiente/build exibida no topo de
 *                   `orders`, como página dedicada
 *   - api         — testar endpoints da API sem sair do celular
 */
const TOOLS = [
  { slug: "orders", label: "Orders", ready: true, href: "/admin/debug/orders" },
  { slug: "tables", label: "Tables", ready: false, href: "/admin/debug/tables" },
  { slug: "sessions", label: "Sessions", ready: false, href: "/admin/debug/sessions" },
  { slug: "restaurant", label: "Restaurant", ready: false, href: "/admin/debug/restaurant" },
  { slug: "environment", label: "Environment", ready: false, href: "/admin/debug/environment" },
  { slug: "api", label: "API", ready: false, href: "/admin/debug/api" },
] as const;

export default function DebugToolsLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: "monospace", fontSize: 13, background: "#fff", color: "#111", minHeight: "100vh" }}>
      <div style={{ background: "#c00", color: "#fff", padding: "8px 16px" }}>
        <strong>🛠 Debug Tools</strong> — ferramenta interna de desenvolvimento. Somente leitura, nenhuma ação
        destrutiva.
      </div>
      <nav style={{ display: "flex", gap: 4, flexWrap: "wrap", padding: "10px 16px", borderBottom: "1px solid #ddd" }}>
        {TOOLS.map((tool) =>
          tool.ready ? (
            <Link
              key={tool.slug}
              href={tool.href}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                background: "#eee",
                color: "#111",
                textDecoration: "none",
              }}
            >
              {tool.label}
            </Link>
          ) : (
            <span
              key={tool.slug}
              title="Ainda não implementado"
              style={{ padding: "6px 10px", borderRadius: 6, background: "#f5f5f5", color: "#999" }}
            >
              {tool.label} <em>(em breve)</em>
            </span>
          ),
        )}
      </nav>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}
