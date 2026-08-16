import { createClient } from "@/lib/supabase/client";

/**
 * Upload de imagem de CATEGORIA (2026-08-15) — mesmo bucket, mesma
 * política RLS e mesmo raciocínio de `lib/storage/product-images.ts`
 * (só a pasta muda: `{restaurant_id}/categories/...` em vez de
 * `.../products/...`). A política do bucket (migration `0013`) só olha
 * o PRIMEIRO segmento do caminho (`{restaurant_id}`), não a pasta
 * seguinte — nenhuma migration de Storage nova foi necessária, a mesma
 * política já cobre esta pasta.
 *
 * Sem etapa de recorte (2026-08-16, pedido explícito do dono, "chega,
 * tenta outro modelo"): 3 tentativas de corrigir o editor de recorte
 * aninhado dentro do modal de categoria não resolveram um bug real de
 * navegador (2 `<dialog>` nativos empilhados fechando juntos, perdendo o
 * upload). Decisão: pra um avatar pequeno e decorativo (círculo de
 * categoria, não a foto principal de um produto), abrir mão do recorte
 * fino elimina o problema pela raiz em vez de tentar contorná-lo de
 * novo. Upload direto do arquivo original — `object-cover` no CSS já
 * centraliza razoavelmente sozinho (ver `category-image-upload.tsx`).
 */

export const CATEGORY_IMAGES_BUCKET = "restaurant-media";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class CategoryImageError extends Error {}

export function validateCategoryImageFile(file: File): void {
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    throw new CategoryImageError("Formato não aceito. Envie uma imagem JPG, JPEG, PNG ou WEBP.");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new CategoryImageError("A imagem é muito grande. O limite é 5 MB.");
  }
}

function buildPath(restaurantId: string, mimeType: string): string {
  const extension = EXTENSION_BY_MIME[mimeType] ?? "jpg";
  return `${restaurantId}/categories/${crypto.randomUUID()}.${extension}`;
}

/**
 * Sobe o arquivo ORIGINAL, sem recorte — mesmo raciocínio do comentário
 * do topo do arquivo. `contentType`/extensão vêm do arquivo de verdade
 * (`file.type`), não mais forçados pra JPEG.
 */
export async function uploadCategoryImage(restaurantId: string, file: File): Promise<string> {
  const path = buildPath(restaurantId, file.type);
  const supabase = createClient();

  const { error } = await supabase.storage
    .from(CATEGORY_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    throw new CategoryImageError("Não foi possível enviar a imagem. Verifique sua internet e tente novamente.");
  }

  const { data } = supabase.storage.from(CATEGORY_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function categoryImageStoragePath(publicUrl: string): string | null {
  const marker = `/object/public/${CATEGORY_IMAGES_BUCKET}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  return publicUrl.slice(index + marker.length);
}

/** Best-effort, mesmo raciocínio de `deleteProductImage` — nunca deve bloquear o salvamento da categoria. */
export async function deleteCategoryImage(publicUrl: string): Promise<void> {
  const path = categoryImageStoragePath(publicUrl);
  if (!path) return;

  try {
    const supabase = createClient();
    await supabase.storage.from(CATEGORY_IMAGES_BUCKET).remove([path]);
  } catch {
    // Best-effort — arquivo órfão no pior caso, nunca um erro visível.
  }
}

