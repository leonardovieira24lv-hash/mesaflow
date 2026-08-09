"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { ImageOff, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { uploadRestaurantLogo } from "@/lib/storage/restaurant-logo";
import { validateProductImageFile, ProductImageError } from "@/lib/storage/product-images";

interface RestaurantLogoUploadProps {
  /** Usado para montar o caminho do arquivo (`{restaurantId}/logo/...`) — o RLS do bucket exige esse prefixo. */
  restaurantId: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

/**
 * Campo "Logo" da seção Identidade — Sprint "Perfil do Restaurante, Fase 1"
 * (2026-08-09). Isolado de `product-image-upload.tsx` de propósito (dono
 * diferente — restaurante, não produto — e caminho de Storage diferente).
 *
 * Sprint "Identidade Visual — Logo com Proporção Livre" (2026-08-09,
 * seguinte): removido o passo de recorte (`<ImageCropEditor>`) — a logo de
 * um restaurante pode ser quadrada, horizontal (wordmark) ou vertical, e o
 * editor de recorte só sabe cortar quadrado. Forçar 1:1 aqui deformaria ou
 * cortaria logos que não são quadradas.
 *
 * `<ImageCropEditor>` e `product-image-upload.tsx` (foto de produto)
 * **não foram tocados nesta mudança** — continuam exatamente como estavam,
 * sempre quadrados, sem nenhum efeito colateral desta Sprint. O fluxo do
 * logo agora é mais simples: seleciona → valida (`validateProductImageFile`,
 * reaproveitada sem duplicação) → sobe direto (`uploadRestaurantLogo`), sem
 * etapa de edição no meio.
 *
 * A prévia abaixo usa `object-contain` (não `object-cover`) numa caixa de
 * altura fixa — para nunca cortar visualmente uma logo não-quadrada aqui,
 * já que ela também não é cortada no upload.
 *
 * "Remover logo" só chama `onChange("")` — mesmo comportamento de
 * `product-image-upload.tsx`, não apaga o arquivo do Storage (ver
 * `deleteRestaurantLogo` em `lib/storage/restaurant-logo.ts` para o porquê).
 */
export function RestaurantLogoUpload({ restaurantId, value, onChange, disabled }: RestaurantLogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Limpa o valor do input imediatamente — sem isso, selecionar o mesmo
    // arquivo de novo (ex.: depois de um erro) não dispara `onChange`.
    event.target.value = "";
    if (!file) return;

    setError(null);
    try {
      validateProductImageFile(file);
    } catch (err) {
      setError(err instanceof ProductImageError ? err.message : "Não foi possível abrir essa imagem.");
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadRestaurantLogo(restaurantId, file);
      onChange(url);
    } catch (err) {
      setError(err instanceof ProductImageError ? err.message : "Não foi possível enviar o logo. Tente novamente.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-4">
        <div className="relative flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-ds2-md border border-ds2-border bg-ds2-surface-hover">
          {value ? (
            <Image src={value} alt="" fill sizes="160px" className="object-contain p-2" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-ds2-surface-hover to-ds2-surface-hover/60">
              <ImageOff className="h-6 w-6 text-ds2-foreground-muted/40" strokeWidth={1.5} aria-hidden />
              <span className="text-xs text-ds2-foreground-muted/70">Sem logo</span>
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-ds2-surface/80 backdrop-blur-[1px]">
              <Loader2 className="h-6 w-6 animate-spin text-ds2-primary" aria-hidden />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || isUploading}
            isLoading={isUploading}
          >
            <Upload className="h-4 w-4" />
            {value ? "Trocar logo" : "Selecionar logo"}
          </Button>

          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange("")}
              disabled={disabled || isUploading}
              className="text-ds2-danger hover:text-ds2-danger"
            >
              <Trash2 className="h-4 w-4" />
              Remover logo
            </Button>
          )}

          <p className="text-xs text-ds2-foreground-muted">
            JPG, PNG ou WEBP · até 5 MB · qualquer proporção (quadrada, horizontal ou vertical)
          </p>
        </div>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Selecionar logo do restaurante"
      />
    </div>
  );
}
