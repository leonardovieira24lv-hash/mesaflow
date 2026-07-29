"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { ImageOff, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { uploadProductImage, ProductImageError } from "@/lib/storage/product-images";

interface ProductImageUploadProps {
  /** Usado para montar o caminho do arquivo (`{restaurantId}/products/...`) — o RLS do bucket exige esse prefixo. */
  restaurantId: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

/**
 * Campo "Foto" do formulário de produto (Sprint "Upload de Imagens dos
 * Produtos", 2026-07-28) — substitui o antigo campo de texto "URL da
 * imagem". Seleciona um arquivo do dispositivo (galeria no Android, seletor
 * de arquivos no desktop/iPhone — comportamento nativo do
 * `<input type="file">`, sem nada customizado por plataforma), envia para o
 * Supabase Storage (`@/lib/storage/product-images`) e chama `onChange` com
 * a URL pública assim que o upload termina — o restante do formulário
 * continua tratando isso como o mesmo `imageUrl` de sempre.
 */
export function ProductImageUpload({ restaurantId, value, onChange, disabled }: ProductImageUploadProps) {
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
    setIsUploading(true);
    try {
      const url = await uploadProductImage(restaurantId, file);
      onChange(url);
    } catch (err) {
      setError(
        err instanceof ProductImageError ? err.message : "Não foi possível enviar a imagem. Tente novamente.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
          {value ? (
            <Image src={value} alt="" fill sizes="80px" className="object-cover" />
          ) : (
            <ImageOff className="h-5 w-5 text-muted-foreground/50" strokeWidth={1.5} aria-hidden />
          )}

          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface/80 backdrop-blur-[1px]">
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
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
          <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP · até 5 MB</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Selecionar imagem do produto"
      />

      {error && <Alert variant="destructive">{error}</Alert>}
    </div>
  );
}
