export const BUSINESS_TYPES = [
  { value: "burger", label: "Hamburgueria", icon: "🍔" },
  { value: "pizza", label: "Pizzaria", icon: "🍕" },
  { value: "acai", label: "Açaíteria", icon: "🍧" },
  { value: "snack", label: "Lanchonete", icon: "🥪" },
  { value: "bar", label: "Bar / Boteco", icon: "🍺" },
  { value: "restaurant", label: "Restaurante", icon: "🍽️" },
  { value: "dessert", label: "Doceria", icon: "🍰" },
  { value: "cafe", label: "Cafeteria", icon: "☕" },
  { value: "other", label: "Outro", icon: "✨" },
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number]["value"];

export function getBusinessTypeLabel(value: string | null | undefined): string {
  return BUSINESS_TYPES.find((item) => item.value === value)?.label ?? "Outro";
}

export interface MenuSetupGuide {
  title: string;
  description: string;
  categoryExample: string;
  productExample: string;
  optionExample: string;
  tip: string;
}

const GUIDES: Record<BusinessType, MenuSetupGuide> = {
  acai: {
    title: "Monte sua açaíteria sem complicação",
    description: "Use uma categoria para reunir seus tipos de açaí. Cada tipo vira um produto e os tamanhos podem ser configurados como uma escolha obrigatória.",
    categoryExample: "Açaí",
    productExample: "Açaí tradicional, Açaí cremoso, Açaí com morango",
    optionExample: "Tamanho: 300 ml, 500 ml, 700 ml, 1 litro",
    tip: "Depois, crie grupos como Complementos, Frutas e Caldas. Se um grupo for opcional, o cliente pode seguir sem escolher nada.",
  },
  burger: {
    title: "Monte sua hamburgueria",
    description: "Crie categorias para organizar os produtos e use grupos de opções para adicionais, molhos e outras escolhas.",
    categoryExample: "Hambúrgueres",
    productExample: "X-Salada, X-Bacon, Duplo Bacon",
    optionExample: "Adicionais: Bacon, Queijo, Ovo",
    tip: "Grupos de opções podem ficar na categoria inteira ou em um produto específico.",
  },
  pizza: {
    title: "Monte sua pizzaria",
    description: "Crie uma categoria para suas pizzas e cadastre cada sabor como produto. Use grupos para bordas e adicionais.",
    categoryExample: "Pizzas",
    productExample: "Calabresa, Frango com Catupiry, Portuguesa",
    optionExample: "Bordas: Catupiry, Cheddar",
    tip: "Se a categoria aceitar meio a meio, ative essa opção na categoria de pizzas.",
  },
  snack: {
    title: "Monte sua lanchonete",
    description: "Organize o cardápio por tipos de produto e use grupos de opções para montar os lanches.",
    categoryExample: "Lanches",
    productExample: "X-Salada, Misto, Cachorro-quente",
    optionExample: "Adicionais: Bacon, Queijo, Ovo",
    tip: "Você pode criar grupos diferentes para cada produto quando as escolhas não forem compartilhadas.",
  },
  bar: {
    title: "Monte seu bar",
    description: "Separe bebidas, porções e outros itens em categorias para deixar o cardápio fácil de navegar.",
    categoryExample: "Bebidas",
    productExample: "Cerveja, Refrigerante, Suco",
    optionExample: "Tamanho: 300 ml, 500 ml, 1 litro",
    tip: "Use o layout compacto em categorias com muitos itens simples, como bebidas.",
  },
  restaurant: {
    title: "Monte seu restaurante",
    description: "Crie categorias para organizar pratos, bebidas, sobremesas e outros itens.",
    categoryExample: "Pratos principais",
    productExample: "Filé, Parmegiana, Frango grelhado",
    optionExample: "Acompanhamentos: Arroz, Batata, Salada",
    tip: "Use grupos de opções para escolhas que o cliente precisa ou pode fazer antes de pedir.",
  },
  dessert: {
    title: "Monte sua doceria",
    description: "Organize doces e sobremesas por categorias e use grupos de opções para sabores, tamanhos e complementos.",
    categoryExample: "Sobremesas",
    productExample: "Brownie, Açaí, Milk-shake",
    optionExample: "Complementos: Nutella, Morango, Granulado",
    tip: "Deixe grupos opcionais quando o cliente puder pedir o produto sem escolher nenhum complemento.",
  },
  cafe: {
    title: "Monte sua cafeteria",
    description: "Separe cafés, comidas e bebidas e use grupos de opções para tamanhos e complementos.",
    categoryExample: "Cafés",
    productExample: "Expresso, Cappuccino, Mocha",
    optionExample: "Tamanho: Pequeno, Médio, Grande",
    tip: "Use grupos específicos do produto quando uma escolha não fizer sentido para toda a categoria.",
  },
  other: {
    title: "Monte seu cardápio do seu jeito",
    description: "Crie categorias para organizar seus produtos e use grupos de opções quando o cliente precisar fazer escolhas.",
    categoryExample: "Uma categoria do seu negócio",
    productExample: "Um produto que você vende",
    optionExample: "Tamanho, adicionais ou complementos",
    tip: "Você pode colocar um grupo na categoria inteira ou somente em um produto.",
  },
};

export function getMenuSetupGuide(value: string | null | undefined): MenuSetupGuide {
  return GUIDES[(value as BusinessType) ?? "other"] ?? GUIDES.other;
}
