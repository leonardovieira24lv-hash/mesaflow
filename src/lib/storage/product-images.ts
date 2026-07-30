import { createClient } from "@/lib/supabase/client";

/**
 * Upload de imagem de produto (Sprint "Upload de Imagens dos Produtos",
 * 2026-07-28). Bucket e políticas em `supabase/migrations/0013_product_images_storage.sql`.
 *
 * Sprint "Editor de Enquadramento da Foto do Produto" (2026-07-29): o
 * redimensionamento/compressão que antes acontecia aqui (`optimizeImage`,
 * a partir do arquivo bruto) passou a acontecer dentro do próprio editor de
 * recorte (`components/cardapio/image-crop-editor.tsx`) — o Canvas de lá já
 * exporta a imagem no tamanho/qualidade final, então este arquivo só
 * precisa validar o arquivo bruto (antes de abrir o editor) e enviar o
 * resultado já pronto pro Storage. Nenhuma biblioteca nova em nenhum dos
 * dois lugares — só Canvas 2D nativo.
 */

export const PRODUCT_IMAGES_BUCKET = "restaurant-media";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

/** Erro com mensagem já pronta para mostrar ao usuário (nunca detalhe técnico). */
export class ProductImageError extends Error {}

/** Validação do arquivo bruto, logo após a seleção — antes de abrir o editor de recorte. */
export function validateProductImageFile(file: File): void {
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    throw new ProductImageError("Formato não aceito. Envie uma imagem JPG, JPEG, PNG ou WEBP.");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ProductImageError("A imagem é muito grande. O limite é 5 MB.");
  }
}

function buildPath(restaurantId: string): string {
  return `${restaurantId}/products/${crypto.randomUUID()}.jpg`;
}

/**
 * Envia a imagem já recortada/enquadrada pelo editor (Blob JPEG, já no
 * tamanho e qualidade finais) e devolve a URL pública salva em
 * `menu_items.image_url`. Sem validação de tipo/tamanho aqui — isso já
 * aconteceu em `validateProductImageFile`, sobre o arquivo original, antes
 * do editor abrir.
 */
export async function uploadCroppedProductImage(restaurantId: string, blob: Blob): Promise<string> {
  const path = buildPath(restaurantId);
  const supabase = createClient();

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });

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
