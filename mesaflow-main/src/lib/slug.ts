/**
 * Gera um slug de URL a partir de um texto livre (nome do restaurante).
 * Usado no onboarding (contrato seção 2.1) para derivar `restaurants.slug`
 * automaticamente a partir de `restaurant_name` — o usuário nunca digita o
 * slug diretamente nesta etapa.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Gera o próximo candidato de slug em caso de conflito de unicidade
 * (ex.: "brecho-tititi" -> "brecho-tititi-2" -> "brecho-tititi-3").
 */
export function nextSlugCandidate(baseSlug: string, attempt: number): string {
  return attempt <= 1 ? baseSlug : `${baseSlug}-${attempt}`;
}
