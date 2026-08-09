import { createClient } from "@/lib/supabase/client";
import { PRODUCT_IMAGES_BUCKET, productImageStoragePath, ProductImageError } from "@/lib/storage/product-images";

/**
 * Upload do logo do restaurante (Sprint "Perfil do Restaurante, Fase 1",
 * 2026-08-09). Reaproveita o mesmo bucket e a mesma validação de arquivo
 * (`validateProductImageFile`, importada de `product-images.ts` sem
 * duplicação — a checagem de tipo/tamanho não é específica de produto,
 * apesar do nome). Nenhuma migration de bucket/policy nova é necessária: as
 * policies de `0013_product_images_storage.sql` autorizam qualquer caminho
 * dentro de `{restaurant_id}/...`, não só `{restaurant_id}/products/...`
 * (confirmado por auditoria antes desta Sprint) — só o padrão de caminho
 * muda, para `{restaurant_id}/logo/...`.
 *
 * Sprint "Identidade Visual — Logo com Proporção Livre" (2026-08-09,
 * seguinte): o logo PAROU de passar pelo `ImageCropEditor` (que só sabe
 * recortar quadrado, 1:1) — deliberado, para permitir logo horizontal,
 * vertical ou quadrada, sem deformar. O `ImageCropEditor` continua
 * inalterado, servindo só o upload de foto de produto (que continua sempre
 * quadrado, sem nenhuma mudança). O arquivo agora sobe exatamente como o
 * dono selecionou, sem recorte nem conversão — só a validação de
 * tipo/tamanho já existente.
 *
 * `PRODUCT_IMAGES_BUCKET`/`productImageStoragePath` são importados, não
 * duplicados — o nome da constante é histórico (bucket já nasceu genérico,
 * chamado `restaurant-media`, não `product-images`) e a extração de path a
 * partir da URL pública já funciona para qualquer caminho dentro do bucket,
 * não só `/products/`.
 */

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function buildLogoPath(restaurantId: string, mimeType: string): string {
  const extension = EXTENSION_BY_MIME_TYPE[mimeType] ?? "jpg";
  return `${restaurantId}/logo/${crypto.randomUUID()}.${extension}`;
}

/**
 * Envia o arquivo de logo exatamente como selecionado (sem recorte, sem
 * conversão de formato — ver docstring do arquivo) e devolve a URL pública
 * a ser salva em `restaurants.logo_url`. `file.type` decide a extensão do
 * caminho e o `contentType` do upload, para o arquivo servido pelo Storage
 * bater com o que o dono realmente enviou (jpg/png/webp).
 */
export async function uploadRestaurantLogo(restaurantId: string, file: File): Promise<string> {
  const path = buildLogoPath(restaurantId, file.type);
  const supabase = createClient();

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    throw new ProductImageError("Não foi possível enviar o logo. Verifique sua internet e tente novamente.");
  }

  const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Remove um logo do Storage a partir da URL pública salva. Best-effort,
 * mesmo padrão de `deleteProductImage` — uma falha aqui nunca deve
 * bloquear nenhum fluxo de salvamento.
 *
 * NÃO é chamada automaticamente nesta Fase 1 (ver
 * `restaurant-logo-upload.tsx`): remover/trocar o logo no formulário só
 * atualiza a URL salva em `restaurants.logo_url`, sem apagar o arquivo
 * antigo do Storage — mesmo comportamento observado em
 * `product-image-upload.tsx` (o botão "Remover imagem" também só limpa o
 * valor do campo). Fica disponível para uso futuro, caso decida adicionar
 * a limpeza automática.
 */
export async function deleteRestaurantLogo(publicUrl: string): Promise<void> {
  const path = productImageStoragePath(publicUrl);
  if (!path) return;

  try {
    const supabase = createClient();
    await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]);
  } catch {
    // Best-effort: mesma justificativa de `deleteProductImage`.
  }
}
