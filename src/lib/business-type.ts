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
    description: "Crie uma categoria como Açaí e cadastre cada tipo como um produto. Dentro de cada açaí, cadastre os tamanhos com seus próprios preços; na categoria, crie os grupos de Complementos, Frutas e Caldas.",
    categoryExample: "Açaí",
    productExample: "Açaí tradicional, Açaí cremoso, Açaí com morango",
    optionExample: "Tamanhos: 300 ml R$15, 500 ml R$18, 1 litro R$27",
    tip: "Não crie uma categoria para cada tamanho. Cada tipo de açaí é um produto, os tamanhos ficam dentro dele e os complementos gerais ficam na categoria.",
  },
  burger: {
    title: "Monte sua hamburgueria",
    description: "Crie categorias como Hambúrgueres e cadastre cada hambúrguer como produto. Use grupos para adicionais, molhos e escolhas que se repetem.",
    categoryExample: "Hambúrgueres",
    productExample: "X-Salada, X-Bacon, Duplo Bacon",
    optionExample: "Adicionais: Bacon, Queijo, Ovo",
    tip: "Grupos de opções podem ficar na categoria inteira ou em um produto específico.",
  },
  pizza: {
    title: "Monte sua pizzaria",
    description: "Crie uma categoria como Pizzas e cadastre cada sabor como produto. Use grupos para bordas e adicionais; meio a meio é uma configuração da categoria.",
    categoryExample: "Pizzas",
    productExample: "Calabresa, Frango com Catupiry, Portuguesa",
    optionExample: "Bordas: Catupiry, Cheddar",
    tip: "Se a categoria aceitar meio a meio, ative essa opção na categoria de pizzas.",
  },
  snack: {
    title: "Monte sua lanchonete",
    description: "Organize por categorias como Lanches e Bebidas. Cada lanche vira um produto e os grupos de opções cuidam de adicionais e escolhas.",
    categoryExample: "Lanches",
    productExample: "X-Salada, Misto, Cachorro-quente",
    optionExample: "Adicionais: Bacon, Queijo, Ovo",
    tip: "Você pode criar grupos diferentes para cada produto quando as escolhas não forem compartilhadas.",
  },
  bar: {
    title: "Monte seu bar",
    description: "Separe Bebidas, Porções e outros itens em categorias. Use grupos de opções apenas quando o cliente tiver algo para escolher.",
    categoryExample: "Bebidas",
    productExample: "Cerveja, Refrigerante, Suco",
    optionExample: "Tamanho: 300 ml, 500 ml, 1 litro",
    tip: "Use o layout compacto em categorias com muitos itens simples, como bebidas.",
  },
  restaurant: {
    title: "Monte seu restaurante",
    description: "Crie categorias como Pratos, Bebidas e Sobremesas. Cada item vira um produto; use grupos de opções para acompanhamentos e escolhas.",
    categoryExample: "Pratos principais",
    productExample: "Filé, Parmegiana, Frango grelhado",
    optionExample: "Acompanhamentos: Arroz, Batata, Salada",
    tip: "Use grupos de opções para escolhas que o cliente precisa ou pode fazer antes de pedir.",
  },
  dessert: {
    title: "Monte sua doceria",
    description: "Organize doces e sobremesas por categorias. Cada produto pode ter grupos para tamanhos, sabores e complementos.",
    categoryExample: "Sobremesas",
    productExample: "Brownie, Açaí, Milk-shake",
    optionExample: "Complementos: Nutella, Morango, Granulado",
    tip: "Deixe grupos opcionais quando o cliente puder pedir o produto sem escolher nenhum complemento.",
  },
  cafe: {
    title: "Monte sua cafeteria",
    description: "Separe Cafés, Comidas e Bebidas. Use grupos de opções para tamanhos e complementos quando fizer sentido.",
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
