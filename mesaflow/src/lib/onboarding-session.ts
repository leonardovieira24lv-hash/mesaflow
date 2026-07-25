/**
 * Ponte efêmera entre as páginas do wizard de onboarding — não é
 * persistência de dados de negócio, só carrega o `slug` do restaurante
 * (retornado no passo 1) até o passo 3, onde ele é necessário para montar
 * a URL de cada QR Code. Vive só em `sessionStorage` (some ao fechar a aba).
 */
const SLUG_SESSION_KEY = "mesaflow_onboarding_slug";

export function setOnboardingSlug(slug: string) {
  if (typeof window !== "undefined") sessionStorage.setItem(SLUG_SESSION_KEY, slug);
}

export function getOnboardingSlug(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(SLUG_SESSION_KEY);
}
