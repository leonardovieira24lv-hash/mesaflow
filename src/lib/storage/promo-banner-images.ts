import { createClient } from "@/lib/supabase/client";

/**
 * Upload de imagem do BANNER PROMOCIONAL (2026-08-16) — mesmo bucket,
 * mesma política RLS de `lib/storage/category-images.ts` (só a pasta
 * muda: `{restaurant_id}/promo-banner/...`).
 *
 * Upload DIRETO, sem etapa de recorte — mesma lição aprendida com a foto
 * de categoria (3 tentativas de corrigir um editor de recorte aninhado
 * dentro de modal nunca resolveram um bug real de navegador; decisão do
 * dono foi abrir mão do recorte fino em vez de insistir). Igual lá, o
 * dono deve ter equipe própria pra preparar a imagem já no formato certo
 * — a UI só avisa o formato recomendado (banner horizontal), não impõe.
 */

export const PROMO_BANNER_IMAGES_BUCKET = "restaurant-media";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class PromoBannerImageError extends Error {}

export function validatePromoBannerImageFile(file: File): void {
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    throw new PromoBannerImageError("Formato não aceito. Envie uma imagem JPG, JPEG, PNG ou WEBP.");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new PromoBannerImageError("A imagem é muito grande. O limite é 5 MB.");
  }
}

function buildPath(restaurantId: string, mimeType: string): string {
  const extension = EXTENSION_BY_MIME[mimeType] ?? "jpg";
  return `${restaurantId}/promo-banner/${crypto.randomUUID()}.${extension}`;
}

export async function uploadPromoBannerImage(restaurantId: string, file: File): Promise<string> {
  const path = buildPath(restaurantId, file.type);
  const supabase = createClient();

  const { error } = await supabase.storage
    .from(PROMO_BANNER_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    throw new PromoBannerImageError("Não foi possível enviar a imagem. Verifique sua internet e tente novamente.");
  }

  const { data } = supabase.storage.from(PROMO_BANNER_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function promoBannerImageStoragePath(publicUrl: string): string | null {
  const marker = `/object/public/${PROMO_BANNER_IMAGES_BUCKET}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  return publicUrl.slice(index + marker.length);
}

/** Best-effort, mesmo raciocínio de `deleteCategoryImage` — nunca deve bloquear o salvamento. */
export async function deletePromoBannerImage(publicUrl: string): Promise<void> {
  const path = promoBannerImageStoragePath(publicUrl);
  if (!path) return;

  try {
    const supabase = createClient();
    await supabase.storage.from(PROMO_BANNER_IMAGES_BUCKET).remove([path]);
  } catch {
    // Best-effort — arquivo órfão no pior caso, nunca um erro visível.
  }
}
