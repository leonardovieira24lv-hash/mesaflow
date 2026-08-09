import { createClient } from "@/lib/supabase/client";
import { PRODUCT_IMAGES_BUCKET, productImageStoragePath, ProductImageError } from "@/lib/storage/product-images";

/**
 * Upload do logo do restaurante (Sprint "Perfil do Restaurante, Fase 1",
 * 2026-08-09). Reaproveita o mesmo bucket, a mesma validação de arquivo
 * (`validateProductImageFile`, importada de `product-images.ts` sem
 * duplicação — a checagem de tipo/tamanho não é específica de produto,
 * apesar do nome) e o mesmo `ImageCropEditor` já usados pelo upload de foto
 * de produto. Nenhuma migration de bucket/policy nova é necessária: as
 * policies de `0013_product_images_storage.sql` autorizam qualquer caminho
 * dentro de `{restaurant_id}/...`, não só `{restaurant_id}/products/...`
 * (confirmado por auditoria antes desta Sprint) — só o padrão de caminho
 * muda, para `{restaurant_id}/logo/...`.
 *
 * `PRODUCT_IMAGES_BUCKET`/`productImageStoragePath` são importados, não
 * duplicados — o nome da constante é histórico (bucket já nasceu genérico,
 * chamado `restaurant-media`, não `product-images`) e a extração de path a
 * partir da URL pública já funciona para qualquer caminho dentro do bucket,
 * não só `/products/`.
 */

function buildLogoPath(restaurantId: string): string {
  return `${restaurantId}/logo/${crypto.randomUUID()}.jpg`;
}

/**
 * Envia o logo já recortado pelo `ImageCropEditor` (Blob JPEG, já no
 * tamanho/qualidade finais) e devolve a URL pública a ser salva em
 * `restaurants.logo_url`. Mesmo fluxo de `uploadCroppedProductImage`, só
 * trocando o padrão de caminho.
 */
export async function uploadRestaurantLogo(restaurantId: string, blob: Blob): Promise<string> {
  const path = buildLogoPath(restaurantId);
  const supabase = createClient();

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });

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
