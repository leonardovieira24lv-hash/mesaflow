"use client";

import { useState } from "react";

export interface OrderDebugRow {
  id: string;
  status: string;
  restaurant_id: string;
  table_id: string;
  order_session_id: string | null;
  total_amount: number;
  created_at: string;
  updated_at: string;
  table: { id: string; restaurant_id: string; name: string; status: string } | null;
  session: { id: string; restaurant_id: string; table_id: string; opened_at: string; closed_at: string | null } | null;
  activeOrdersOnSameTable: { id: string; status: string; created_at: string }[];
  restaurantExists: boolean;
  inconsistencies: string[];
}

interface OrdersDebugClientProps {
  rows: OrderDebugRow[];
  profileRestaurantId: string;
}

/**
 * Debug Tools / Orders — a parte interativa. O Server Component
 * (`page.tsx`) já buscou e cruzou tudo (mesa, sessão, contagem de pedidos
 * ativos, inconsistências) — este componente só lida com o que precisa de
 * `"use client"`: clipboard e o estado de "qual pedido está selecionado"
 * pra atualizar a barra superior.
 */
export function OrdersDebugClient({ rows, profileRestaurantId }: OrdersDebugClientProps) {
  const [selected, setSelected] = useState<OrderDebugRow | null>(null);
  const [copiedFeedback, setCopiedFeedback] = useState<string | null>(null);

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFeedback(label);
      setTimeout(() => setCopiedFeedback(null), 1500);
    } catch {
      setCopiedFeedback(`Não foi possível copiar (${label})`);
      setTimeout(() => setCopiedFeedback(null), 2500);
    }
  }

  return (
    <div>
      <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: 10, marginBottom: 14, background: "#fafafa" }}>
        <p>
          <strong>Restaurant ID do usuário logado:</strong> {profileRestaurantId}
        </p>
        <p>
          <strong>Restaurant ID do pedido selecionado:</strong>{" "}
          {selected ? (
            <>
              {selected.restaurant_id}
              {selected.restaurant_id !== profileRestaurantId && (
                <span style={{ color: "#c00", fontWeight: 700 }}> ⚠️ diferente do seu usuário logado</span>
              )}
            </>
          ) : (
            <em style={{ color: "#999" }}>nenhum pedido selecionado — clique em &quot;Abrir inspeção&quot;</em>
          )}
        </p>
        {copiedFeedback && <p style={{ color: "#080" }}>✓ Copiado: {copiedFeedback}</p>}
      </div>

      <table border={1} cellPadding={5} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead style={{ background: "#eee" }}>
          <tr>
            <th>id</th>
            <th>status</th>
            <th>restaurant_id</th>
            <th>table_id</th>
            <th>order_session_id</th>
            <th>created_at</th>
            <th>updated_at</th>
            <th>Sessão aberta?</th>
            <th>Mesa existe?</th>
            <th>Pedidos ativos na mesa</th>
            <th>Inconsistências</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSelected = selected?.id === row.id;
            return (
              <tr
                key={row.id}
                style={{
                  background: row.inconsistencies.length > 0 ? "#fee2e2" : isSelected ? "#e0f2fe" : undefined,
                }}
              >
                <td style={{ maxWidth: 140, overflowWrap: "anywhere" }}>{row.id}</td>
                <td>
                  <strong>{row.status}</strong>
                </td>
                <td>{row.restaurant_id}</td>
                <td style={{ maxWidth: 140, overflowWrap: "anywhere" }}>{row.table_id}</td>
                <td style={{ maxWidth: 140, overflowWrap: "anywhere" }}>{row.order_session_id ?? "—"}</td>
                <td>{row.created_at}</td>
                <td>{row.updated_at}</td>
                <td>
                  {!row.order_session_id
                    ? "—"
                    : row.session
                      ? row.session.closed_at
                        ? `Não — fechada em ${row.session.closed_at}`
                        : "Sim, aberta"
                      : "⚠️ não encontrada"}
                </td>
                <td>{row.table ? `Sim — "${row.table.name}" (${row.table.status})` : "⚠️ NÃO EXISTE"}</td>
                <td>
                  {row.activeOrdersOnSameTable.length}
                  {row.activeOrdersOnSameTable.length > 1 && " ⚠️"}
                </td>
                <td>
                  {row.inconsistencies.length === 0 ? (
                    <span style={{ color: "#080" }}>nenhuma</span>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 16, color: "#c00" }}>
                      {row.inconsistencies.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  )}
                </td>
                <td style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 110 }}>
                  <button type="button" onClick={() => copyText(row.id, "ID do pedido")}>
                    Copiar ID
                  </button>
                  <button type="button" onClick={() => copyText(JSON.stringify(row, null, 2), "JSON do pedido")}>
                    Copiar JSON
                  </button>
                  <button type="button" onClick={() => setSelected(row)}>
                    Abrir inspeção
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {selected && (
        <div style={{ marginTop: 16, border: "2px solid #0284c7", borderRadius: 6, padding: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>Inspeção — pedido {selected.id}</strong>
            <button type="button" onClick={() => setSelected(null)}>
              Fechar
            </button>
          </div>
          <pre style={{ overflow: "auto", background: "#f5f5f5", padding: 8, marginTop: 8 }}>
            {JSON.stringify(selected, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
