/**
 * Tipos de domínio compartilhados entre front-end e Route Handlers.
 * Espelham as entidades descritas em `api-contracts-v1.md`.
 *
 * Quando o schema do Supabase for gerado (`npm run supabase:types`), os tipos
 * de banco (snake_case, vindos de `database.types.ts`) devem ser mapeados para
 * estes tipos de domínio (camelCase/contrato) na borda da API — nunca vazar o
 * tipo bruto do Postgres direto para o front-end.
 */

export type RestaurantStatus = "onboarding" | "active";

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  status: RestaurantStatus;
}

export interface RestaurantChecklist {
  hasCategories: boolean;
  hasProducts: boolean;
  qrCodesPrinted: boolean;
}

export type TableStatus = "livre" | "ocupada" | "manutencao";

export interface Table {
  id: string;
  name: string;
  status: TableStatus;
  qrToken: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  position: number;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
}

export type OrderStatus = "pending" | "preparing" | "ready" | "delivered" | "cancelled";

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  notes?: string;
}

export interface Order {
  id: string;
  table: Pick<Table, "id" | "name">;
  status: OrderStatus;
  totalAmount: number;
  notes?: string;
  items: OrderItem[];
  createdAt: string;
}

/**
 * Versão resumida de `Order` para telas de listagem (Dashboard, Pedidos em
 * Tempo Real) — troca `items` completos por só a contagem, evitando um
 * payload pesado quando o detalhe não é necessário (contrato seção 8.1:
 * "resumo de itens", não os itens completos, que ficam para 8.2).
 */
export interface OrderListItem {
  id: string;
  table: Pick<Table, "id" | "name">;
  status: OrderStatus;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
}

/** Papéis de usuário previstos no contrato (v1: só `owner`; `staff` chega na v1.1). */
export type UserRole = "owner" | "staff";

export interface Profile {
  id: string;
  restaurantId: string;
  role: UserRole;
}
