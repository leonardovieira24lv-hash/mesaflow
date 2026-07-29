import { createClient } from "@/lib/supabase/client";

/**
 * Upload de imagem de produto (Sprint "Upload de Imagens dos Produtos",
 * 2026-07-28). Bucket e políticas em `supabase/migrations/0013_product_images_storage.sql`.
 *
 * Fluxo: valida o arquivo → redimensiona/comprime no navegador via Canvas
 * (sem nenhuma biblioteca nova) → envia direto para o Supabase Storage
 * usando o cliente do navegador já autenticado (`@/lib/supabase/client`) —
 * o RLS do bucket garante o isolamento por restaurante, então não existe
 * (nem precisa existir) uma API Route própria para este upload.
 */

export const PRODUCT_IMAGES_BUCKET = "restaurant-media";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

/** Erro com mensagem já pronta para mostrar ao usuário (nunca detalhe técnico). */
export class ProductImageError extends Error {}

function validateFile(file: File): void {
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    throw new ProductImageError("Formato não aceito. Envie uma imagem JPG, JPEG, PNG ou WEBP.");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ProductImageError("A imagem é muito grande. O limite é 5 MB.");
  }
}

/**
 * Redimensiona (maior lado até `MAX_DIMENSION`) e recomprime como JPEG
 * (`JPEG_QUALITY`) — sempre recodifica, mesmo PNG/WEBP de entrada: fotos de
 * prato não precisam de transparência, e um único formato de saída mantém
 * o `contentType`/extensão do Storage simples e previsíveis. Se o
 * navegador não suportar Canvas 2D (praticamente nunca), usa o arquivo
 * original como fallback em vez de travar o upload.
 */
async function optimizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  return blob ?? file;
}

function buildPath(restaurantId: string): string {
  return `${restaurantId}/products/${crypto.randomUUID()}.jpg`;
}

/** Faz upload da imagem já validada/otimizada e devolve a URL pública salva em `menu_items.image_url`. */
export async function uploadProductImage(restaurantId: string, file: File): Promise<string> {
  validateFile(file);

  let optimized: Blob;
  try {
    optimized = await optimizeImage(file);
  } catch {
    throw new ProductImageError("Não foi possível processar essa imagem. Tente outro arquivo.");
  }

  const path = buildPath(restaurantId);
  const supabase = createClient();

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, optimized, { contentType: "image/jpeg", upsert: false });

  if (error) {
    throw new ProductImageError("Não foi possível enviar a imagem. Verifique sua internet e tente novamente.");
  }

  const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Extrai o caminho dentro do bucket a partir da URL pública salva no
 * produto — não existe (nem precisa existir) uma coluna separada para o
 * path, a própria URL já contém essa informação. Retorna `null` para
 * qualquer URL que não seja deste bucket (ex.: imagem antiga colada
 * manualmente antes desta sprint) — nesse caso não há nada do nosso
 * Storage para remover.
 */
export function productImageStoragePath(publicUrl: string): string | null {
  const marker = `/object/public/${PRODUCT_IMAGES_BUCKET}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  return publicUrl.slice(index + marker.length);
}

/** Remove a imagem antiga do Storage ao substituir — silencioso em caso de falha (nunca deve bloquear o salvamento do produto). */
export async function deleteProductImage(publicUrl: string): Promise<void> {
  const path = productImageStoragePath(publicUrl);
  if (!path) return;

  try {
    const supabase = createClient();
    await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]);
  } catch {
    // Best-effort: se a remoção falhar (rede, etc.), o pior caso é um
    // arquivo órfão no Storage — nunca deve virar um erro visível para
    // quem só estava tentando salvar o produto.
  }
}
