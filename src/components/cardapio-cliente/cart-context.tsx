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

export interface SelectedOption {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  /**
   * Sistema de Opcionais, Fase 1 (2026-08-14) — escolhas feitas nos
   * grupos de opção deste produto (ex.: Borda: Catupiry). Vazio/ausente
   * quando o produto não tem nenhum grupo aplicável. `price` acima já
   * vem com o(s) `priceDelta` somado — este array é só para exibição
   * (mostrar "Catupiry" na linha do carrinho) e para o pedido saber o
   * que gravar em `order_items.selected_options`.
   */
  selectedOptions?: SelectedOption[];
  /**
   * Puramente de apresentação (miniatura na linha do carrinho) — não faz
   * parte do contrato de `POST /orders` (seção 3.3, só `menu_item_id` /
   * `quantity` / `notes`) nem é persistido no backend; vive só no
   * `sessionStorage` deste carrinho, junto do resto do `CartItem`.
   */
  imageUrl?: string;
}

interface CartContextValue {
  /** Token da mesa (contrato 3.3: `table_token`) usado ao finalizar o pedido na Fase 4. `null` se o cliente chegou ao cardápio sem passar pela mesa resolvedora. */
  tableToken: string | null;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (item: CartItem) => void;
  updateQuantity: (
    menuItemId: string,
    notes: string | undefined,
    selectedOptions: SelectedOption[] | undefined,
    quantity: number,
  ) => void;
  removeItem: (menuItemId: string, notes: string | undefined, selectedOptions: SelectedOption[] | undefined) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function cartStorageKey(slug: string, tableToken: string | null): string {
  return `mesaflow:cart:${slug}:${tableToken ?? "sem-mesa"}`;
}

/**
 * Sistema de Opcionais, Fase 1 (2026-08-14) — "assinatura" estável das
 * opções escolhidas, pra comparar duas linhas: ids ordenados (a ordem que
 * o cliente marcou nunca deveria importar) e concatenados. `undefined`/
 * array vazio viram a mesma string (`""`) — produto sem opção nenhuma.
 */
function optionsSignature(options: SelectedOption[] | undefined): string {
  return (options ?? [])
    .map((o) => o.optionId)
    .sort()
    .join(",");
}

/**
 * Duas linhas do carrinho são "a mesma linha" se forem o mesmo produto,
 * com a mesma observação, E a mesma escolha de opções — pedido explícito
 * do dono: "a lista deve separar o item toda vez que houver observações
 * diferentes, pra cozinha diferenciar". Antes de Opcionais, só
 * `menuItemId`+`notes` decidiam isso; `optionsSignature` agora entra na
 * mesma checagem, exatamente com o mesmo peso.
 */
function sameLine(
  a: Pick<CartItem, "menuItemId" | "notes" | "selectedOptions">,
  b: Pick<CartItem, "menuItemId" | "notes" | "selectedOptions">,
): boolean {
  return (
    a.menuItemId === b.menuItemId &&
    (a.notes ?? "") === (b.notes ?? "") &&
    optionsSignature(a.selectedOptions) === optionsSignature(b.selectedOptions)
  );
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

  const updateQuantity = useCallback(
    (menuItemId: string, notes: string | undefined, selectedOptions: SelectedOption[] | undefined, quantity: number) => {
      setItems((prev) => {
        if (quantity <= 0) return prev.filter((line) => !sameLine(line, { menuItemId, notes, selectedOptions }));
        return prev.map((line) =>
          sameLine(line, { menuItemId, notes, selectedOptions }) ? { ...line, quantity } : line,
        );
      });
    },
    [],
  );

  const removeItem = useCallback(
    (menuItemId: string, notes: string | undefined, selectedOptions: SelectedOption[] | undefined) => {
      setItems((prev) => prev.filter((line) => !sameLine(line, { menuItemId, notes, selectedOptions })));
    },
    [],
  );

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
