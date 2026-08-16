"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { ImageOff, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import {
  uploadPromoBannerImage,
  validatePromoBannerImageFile,
  PromoBannerImageError,
} from "@/lib/storage/promo-banner-images";

interface PromoBannerUploadProps {
  restaurantId: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

/**
 * Campo "Imagem" do Banner Promocional — estudo de caso de concorrentes
 * (2026-08-16). Mesmo padrão de `restaurant-logo-upload.tsx`: upload
 * DIRETO, sem `<ImageCropEditor>` — mesma lição aprendida com a foto de
 * categoria (3 tentativas de corrigir o editor de recorte aninhado
 * dentro de modal nunca resolveram um bug real de navegador; decisão do
 * dono foi abrir mão do recorte fino em vez de insistir).
 *
 * Diferente do logo (proporção livre, `object-contain`) e do avatar de
 * categoria (círculo, `object-cover`): o banner tem uma proporção
 * ESPERADA — horizontal, exibido a 3:1 no Cardápio Público
 * (`cardapio-cliente-view.tsx`). Sem editor de recorte pra garantir
 * isso, a prévia aqui já mostra a caixa no formato final (3:1,
 * `object-cover`) — o dono vê na hora se a imagem que escolheu vai
 * ficar cortada de um jeito ruim, e a dica de texto abaixo diz o formato
 * recomendado explicitamente (dúvida real do dono: "como a pessoa vai
 * entender que o banner tem que ser horizontal?").
 */
export function PromoBannerUpload({ restaurantId, value, onChange, disabled }: PromoBannerUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    try {
      validatePromoBannerImageFile(file);
    } catch (err) {
      setError(err instanceof PromoBannerImageError ? err.message : "Não foi possível abrir essa imagem.");
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadPromoBannerImage(restaurantId, file);
      onChange(url);
    } catch (err) {
      setError(
        err instanceof PromoBannerImageError ? err.message : "Não foi possível enviar a imagem. Tente novamente.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[3/1] w-full overflow-hidden rounded-ds2-md border border-ds2-border bg-ds2-surface-hover">
        {value ? (
          <Image src={value} alt="" fill sizes="512px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-ds2-surface-hover to-ds2-surface-hover/60">
            <ImageOff className="h-6 w-6 text-ds2-foreground-muted/40" strokeWidth={1.5} aria-hidden />
            <span className="text-xs text-ds2-foreground-muted/70">Sem banner</span>
          </div>
        )}

        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-ds2-surface/80 backdrop-blur-[1px]">
            <Loader2 className="h-6 w-6 animate-spin text-ds2-primary" aria-hidden />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading}
          isLoading={isUploading}
        >
          <Upload className="h-4 w-4" />
          {value ? "Trocar imagem" : "Selecionar imagem"}
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
            Remover imagem
          </Button>
        )}
      </div>

      <p className="text-xs text-ds2-foreground-muted">
        JPG, PNG ou WEBP · até 5 MB · <strong className="font-semibold">formato horizontal</strong> (ex.: 1200×400px)
        — uma imagem quadrada ou vertical vai ficar cortada nas laterais.
      </p>

      {error && <Alert variant="destructive">{error}</Alert>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Selecionar imagem do banner promocional"
      />
    </div>
  );
}
