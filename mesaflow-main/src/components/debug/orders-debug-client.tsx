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
 * Debug Tools / Orders — a parte interativa.
 *
 * Sprint de correção mobile: os botões da coluna "Ações" não tinham
 * NENHUMA classe/estilo — o preflight do Tailwind (ativo em todo o
 * projeto, `corePlugins.preflight` nunca desabilitado) reseta a aparência
 * padrão de `<button>` (sem borda/fundo/padding). O `onClick` sempre
 * funcionou; o que não existia era uma ÁREA DE TOQUE real — sem padding
 * nenhum, o alvo tocável encolhe pro tamanho exato do texto, e dentro de
 * uma tabela de 12 colunas espremida numa tela de ~360px de largura, essa
 * já-pequena área ainda ficava distorcida pelo algoritmo de layout
 * automático da tabela. No mouse (desktop) isso passa despercebido, no
 * dedo (touch) é praticamente impossível de acertar.
 *
 * Correção: classes reais do Tailwind em todo botão (área de toque grande
 * de propósito) + duas visões completamente separadas — tabela (`md:` pra
 * cima) e cards em coluna única (abaixo de `md`), em vez de tentar forçar
 * a mesma tabela a caber numa tela de celular.
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

  function sessionLabel(row: OrderDebugRow): string {
    if (!row.order_session_id) return "—";
    if (!row.session) return "⚠️ não encontrada";
    return row.session.closed_at ? `Não — fechada em ${row.session.closed_at}` : "Sim, aberta";
  }

  function tableLabel(row: OrderDebugRow): string {
    return row.table ? `"${row.table.name}" (${row.table.status})` : "⚠️ NÃO EXISTE";
  }

  return (
    <div>
      <div className="mb-4 rounded-md border border-gray-300 bg-gray-50 p-3">
        <p className="break-all">
          <strong>Restaurant ID do usuário logado:</strong> {profileRestaurantId}
        </p>
        <p className="break-all">
          <strong>Restaurant ID do pedido selecionado:</strong>{" "}
          {selected ? (
            <>
              {selected.restaurant_id}
              {selected.restaurant_id !== profileRestaurantId && (
                <span className="font-bold text-red-600"> ⚠️ diferente do seu usuário logado</span>
              )}
            </>
          ) : (
            <em className="text-gray-500">nenhum pedido selecionado — toque em &quot;Abrir inspeção&quot;</em>
          )}
        </p>
        {copiedFeedback && <p className="text-green-700">✓ Copiado: {copiedFeedback}</p>}
      </div>

      {/* ===== Mobile (abaixo de md): um card por pedido ===== */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <div
            key={row.id}
            className={`rounded-lg border p-3 text-sm ${
              row.inconsistencies.length > 0 ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"
            }`}
          >
            <p className="break-all">
              <strong>ID:</strong> {row.id}
            </p>
            <p>
              <strong>Status:</strong> {row.status}
            </p>
            <p className="break-all">
              <strong>Restaurant ID:</strong> {row.restaurant_id}
            </p>
            <p>
              <strong>Mesa:</strong> {tableLabel(row)}
            </p>
            <p>
              <strong>Sessão:</strong> {sessionLabel(row)}
            </p>
            <p>
              <strong>Pedidos ativos na mesa:</strong> {row.activeOrdersOnSameTable.length}
              {row.activeOrdersOnSameTable.length > 1 && " ⚠️"}
            </p>
            <div className="mt-1">
              <strong>Inconsistências:</strong>{" "}
              {row.inconsistencies.length === 0 ? (
                <span className="text-green-700">nenhuma</span>
              ) : (
                <ul className="list-disc pl-5 text-red-700">
                  {row.inconsistencies.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setSelected(row)}
                className="w-full rounded-md bg-blue-600 py-3 text-base font-semibold text-white active:bg-blue-800"
              >
                Abrir inspeção
              </button>
              <button
                type="button"
                onClick={() => copyText(row.id, "ID do pedido")}
                className="w-full rounded-md border-2 border-gray-400 bg-white py-3 text-base font-semibold text-gray-900 active:bg-gray-100"
              >
                Copiar ID
              </button>
              <button
                type="button"
                onClick={() => copyText(JSON.stringify(row, null, 2), "JSON do pedido")}
                className="w-full rounded-md border-2 border-gray-400 bg-white py-3 text-base font-semibold text-gray-900 active:bg-gray-100"
              >
                Copiar JSON
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ===== Desktop (md pra cima): tabela ===== */}
      <table className="hidden w-full border-collapse border md:table">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-1.5 text-left">id</th>
            <th className="border p-1.5 text-left">status</th>
            <th className="border p-1.5 text-left">restaurant_id</th>
            <th className="border p-1.5 text-left">table_id</th>
            <th className="border p-1.5 text-left">order_session_id</th>
            <th className="border p-1.5 text-left">created_at</th>
            <th className="border p-1.5 text-left">updated_at</th>
            <th className="border p-1.5 text-left">Sessão aberta?</th>
            <th className="border p-1.5 text-left">Mesa existe?</th>
            <th className="border p-1.5 text-left">Pedidos ativos na mesa</th>
            <th className="border p-1.5 text-left">Inconsistências</th>
            <th className="border p-1.5 text-left">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSelected = selected?.id === row.id;
            return (
              <tr key={row.id} className={row.inconsistencies.length > 0 ? "bg-red-50" : isSelected ? "bg-blue-50" : ""}>
                <td className="max-w-[140px] break-all border p-1.5">{row.id}</td>
                <td className="border p-1.5">
                  <strong>{row.status}</strong>
                </td>
                <td className="border p-1.5">{row.restaurant_id}</td>
                <td className="max-w-[140px] break-all border p-1.5">{row.table_id}</td>
                <td className="max-w-[140px] break-all border p-1.5">{row.order_session_id ?? "—"}</td>
                <td className="border p-1.5">{row.created_at}</td>
                <td className="border p-1.5">{row.updated_at}</td>
                <td className="border p-1.5">{sessionLabel(row)}</td>
                <td className="border p-1.5">{tableLabel(row)}</td>
                <td className="border p-1.5">
                  {row.activeOrdersOnSameTable.length}
                  {row.activeOrdersOnSameTable.length > 1 && " ⚠️"}
                </td>
                <td className="border p-1.5">
                  {row.inconsistencies.length === 0 ? (
                    <span className="text-green-700">nenhuma</span>
                  ) : (
                    <ul className="list-disc pl-4 text-red-700">
                      {row.inconsistencies.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="min-w-[120px] border p-1.5">
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => copyText(row.id, "ID do pedido")}
                      className="rounded border border-gray-400 bg-white px-2 py-1 text-xs font-semibold hover:bg-gray-100"
                    >
                      Copiar ID
                    </button>
                    <button
                      type="button"
                      onClick={() => copyText(JSON.stringify(row, null, 2), "JSON do pedido")}
                      className="rounded border border-gray-400 bg-white px-2 py-1 text-xs font-semibold hover:bg-gray-100"
                    >
                      Copiar JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelected(row)}
                      className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Abrir inspeção
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {selected && (
        <div className="mt-4 rounded-md border-2 border-sky-600 p-3">
          <div className="flex items-center justify-between">
            <strong>Inspeção — pedido {selected.id}</strong>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded border border-gray-400 bg-white px-3 py-1.5 text-sm font-semibold active:bg-gray-100"
            >
              Fechar
            </button>
          </div>
          <pre className="mt-2 max-h-[60vh] overflow-auto whitespace-pre-wrap break-all rounded bg-gray-100 p-2 text-xs">
            {JSON.stringify(selected, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
