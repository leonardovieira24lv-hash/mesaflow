import type { MenuItem } from "@/types/domain";

/**
 * Forma exata de um produto do cardápio como trafega pela API (JSON,
 * snake_case) — contrato seções 6.1 a 6.5 (`GET/POST /api/v1/menu/items`,
 * `GET/PATCH /api/v1/menu/items/{id}`).
 *
 * Única definição no projeto: toda Route Handler que devolve um produto
 * (`toItemDto` em `api/v1/menu/items/route.ts` e
 * `api/v1/menu/items/[id]/route.ts`, ambas com o retorno anotado como
 * `: MenuItemDto` de propósito) e todo componente que lê essa resposta
 * (`product-form.tsx`, `cardapio-manager.tsx`) importam este tipo — nenhum
 * dos dois lados pode voltar a declarar a própria cópia.
 *
 * Motivo de existir (Sprint "Arquitetura — DTO Único de Produto",
 * 2026-07-28): uma segunda cópia desta interface, em `products-list.tsx`
 * (componente já removido na Sprint "Refatoração da Experiência do
 * Cardápio", mas ainda presente no projeto local de quem lê isto — arquivo
 * órfão, sem nenhum import real, mas ainda compilado pelo TypeScript por
 * estar dentro de `src/`), ficou sem o campo `is_archived` quando ele foi
 * adicionado ao domínio — porque era uma cópia manual, não uma referência
 * ao mesmo tipo. Com uma única definição, isso deixa de ser possível: um
 * campo novo aqui obriga toda `toItemDto`/mapeamento a atualizar, ou o
 * build já falha na própria Route Handler, imediatamente — não silenciosamente
 * num componente sem uso real.
 */
export interface MenuItemDto {
  id: string;
  category_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available: boolean;
  is_archived: boolean;
}

/**
 * Converte o DTO (snake_case, formato de fio da API) para `MenuItem`
 * (camelCase, tipo de domínio usado por toda a UI) — única implementação
 * deste mapeamento no projeto.
 */
export function menuItemFromDto(dto: MenuItemDto): MenuItem {
  return {
    id: dto.id,
    categoryId: dto.category_id,
    name: dto.name,
    description: dto.description,
    price: dto.price,
    imageUrl: dto.image_url,
    isAvailable: dto.is_available,
    isArchived: dto.is_archived,
  };
}
