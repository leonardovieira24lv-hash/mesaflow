"use client";

/**
 * INSTRUMENTAÇÃO TEMPORÁRIA — Sprint 2 (Painel Vivo), investigação do bug
 * "card da mesa não mostra pedido em aberto / cor não muda". Remover este
 * arquivo, o link de debug em `tables-manager.tsx` e a rota
 * `/admin/debug/mesas` assim que a causa raiz for confirmada e corrigida.
 *
 * Por que um singleton de módulo em vez de só `console.log`: o
 * desenvolvimento está sendo feito só pelo celular (Android + Termux),
 * sem acesso a DevTools/F12 para ver o console do navegador. Guardando as
 * entradas aqui (em memória, no próprio bundle JS carregado no navegador),
 * a página `/admin/debug/mesas` consegue exibi-las na tela — e como o
 * Next.js App Router faz navegação client-side entre rotas da mesma aba
 * (sem recarregar o JS), esse estado sobrevive a ir de `/mesas` para
 * `/admin/debug/mesas` para conferir o resultado.
 *
 * Limitação importante para o teste: um F5 (recarregamento de página de
 * verdade, não navegação) reseta este módulo — então para o Teste 3
 * (mudar status via Pedidos e depois dar F5 em Mesas), é preciso conferir
 * `/admin/debug/mesas` ANTES do F5 (para ver se o evento Realtime chegou
 * enquanto a mesa estava aberta) e DE NOVO depois do F5 (para ver os logs
 * da nova carga, já com o estado zerado).
 */

export interface MesasDebugLogEntry {
  id: number;
  at: string;
  tag: string;
  data: unknown;
}

type Listener = (entries: MesasDebugLogEntry[]) => void;

const MAX_ENTRIES = 300;

let entries: MesasDebugLogEntry[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

export function pushMesasDebugLog(tag: string, data: unknown) {
  const entry: MesasDebugLogEntry = { id: nextId++, at: new Date().toISOString(), tag, data };
  entries = [...entries, entry].slice(-MAX_ENTRIES);

  // Mantém também no console — quem tiver DevTools disponível (ex.: testando
  // no desktop) continua conseguindo usar a mesma instrumentação sem precisar
  // abrir a página de debug.
  // eslint-disable-next-line no-console
  console.log(`[SPRINT2-DEBUG] ${tag}`, data);

  for (const listener of listeners) listener(entries);
}

export function getMesasDebugLog(): MesasDebugLogEntry[] {
  return entries;
}

export function subscribeMesasDebugLog(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearMesasDebugLog() {
  entries = [];
  nextId = 1;
  for (const listener of listeners) listener(entries);
}
