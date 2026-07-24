"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

interface CartContextValue {
  /** Token da mesa (contrato 3.3: `table_token`) usado ao finalizar o pedido na Fase 4. `null` se o cliente chegou ao cardápio sem passar pela mesa resolvedora. */
  tableToken: string | null;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (item: CartItem) => void;
  updateQuantity: (menuItemId: string, notes: string | undefined, quantity: number) => void;
  removeItem: (menuItemId: string, notes: string | undefined) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function cartStorageKey(slug: string, tableToken: string | null): string {
  return `mesaflow:cart:${slug}:${tableToken ?? "sem-mesa"}`;
}

/** Duas linhas do carrinho são "a mesma linha" se forem o mesmo produto com a mesma observação. */
function sameLine(a: Pick<CartItem, "menuItemId" | "notes">, b: Pick<CartItem, "menuItemId" | "notes">): boolean {
  return a.menuItemId === b.menuItemId && (a.notes ?? "") === (b.notes ?? "");
}

interface CartProviderProps {
  slug: string;
  tableToken: string | null;
  children: ReactNode;
}

/**
 * Estado do carrinho do cliente. O Módulo 3 (tela de Carrinho) e o Módulo 4
 * (Finalização) ainda não existem — chegam na Fase 4 — mas o estado em si já
 * precisa existir para o botão "Adicionar ao carrinho" (Módulo 2, dentro do
 * modal de detalhes do produto) ter efeito visível nesta fase. Persistido em
 * `sessionStorage`, isolado por `slug` + `tableToken`: uma aba aberta em duas
 * mesas diferentes (ou dois restaurantes) nunca compartilha carrinho.
 */
export function CartProvider({ slug, tableToken, children }: CartProviderProps) {
  const key = cartStorageKey(slug, tableToken);
  const [items, setItems] = useState<CartItem[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);

  // Carrega o carrinho salvo desta mesa ao montar (e sempre que a chave mudar
  // — ex.: o mesmo dispositivo escaneou o QR Code de outra mesa).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      setItems(raw ? (JSON.parse(raw) as CartItem[]) : []);
    } catch {
      setItems([]);
    } finally {
      setHasHydrated(true);
    }
  }, [key]);

  useEffect(() => {
    if (!hasHydrated) return; // evita sobrescrever o storage com [] antes da leitura inicial acontecer.
    try {
      sessionStorage.setItem(key, JSON.stringify(items));
    } catch {
      // sessionStorage indisponível (ex.: navegação privada) — o carrinho
      // continua funcionando normalmente em memória pelo resto da sessão.
    }
  }, [key, items, hasHydrated]);

  const addItem = useCallback((newItem: CartItem) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((line) => sameLine(line, newItem));
      if (existingIndex === -1) return [...prev, newItem];

      // `noUncheckedIndexedAccess` (tsconfig) tipa `next[existingIndex]` como
      // possivelmente `undefined`, mesmo vindo de um índice que acabou de ser
      // validado por `findIndex` — guard explícito em vez de non-null
      // assertion, mesmo padrão já usado em `categories-manager.tsx`.
      const next = [...prev];
      const existingLine = next[existingIndex];
      if (!existingLine) return prev;

      next[existingIndex] = { ...existingLine, quantity: existingLine.quantity + newItem.quantity };
      return next;
    });
  }, []);

  const updateQuantity = useCallback((menuItemId: string, notes: string | undefined, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((line) => !sameLine(line, { menuItemId, notes }));
      return prev.map((line) => (sameLine(line, { menuItemId, notes }) ? { ...line, quantity } : line));
    });
  }, []);

  const removeItem = useCallback((menuItemId: string, notes: string | undefined) => {
    setItems((prev) => prev.filter((line) => !sameLine(line, { menuItemId, notes })));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const itemCount = useMemo(() => items.reduce((sum, line) => sum + line.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum, line) => sum + line.price * line.quantity, 0), [items]);

  // Sprint 10 (auditoria de qualidade): sem `useMemo` aqui, este objeto era
  // recriado a cada render do provider, fazendo todo consumidor de
  // `useCart()` re-renderizar mesmo quando nada relevante mudou (ex.: um
  // re-render disparado por outro estado do componente pai). Funções agora
  // em `useCallback` (referência estável) para o `useMemo` abaixo só mudar
  // quando `items`/`tableToken` realmente mudam.
  const value = useMemo<CartContextValue>(
    () => ({
      tableToken,
      items,
      itemCount,
      subtotal,
      addItem,
      updateQuantity,
      removeItem,
      clear,
    }),
    [tableToken, items, itemCount, subtotal, addItem, updateQuantity, removeItem, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart precisa ser usado dentro de <CartProvider>.");
  }
  return ctx;
}
