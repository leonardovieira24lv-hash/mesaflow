"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { ImageOff, Loader2, Trash2, Upload } from "lucide-react";
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
 * Campo "Foto" do formulário de produto.
 *
 * Sprint "Upload de Imagens dos Produtos" (2026-07-28): substituiu o antigo
 * campo de texto "URL da imagem" por um upload de verdade — seletor de
 * arquivo nativo → Supabase Storage → URL pública preenchida
 * automaticamente (`@/lib/storage/product-images`).
 *
 * Sprint "Refatoração da Experiência do Cardápio" (2026-07-28, seguinte):
 * reformulação visual — preview grande e quadrada (1:1, `object-cover`,
 * cantos arredondados) em vez do miniatura antiga, placeholder mais
 * elegante sem foto, e um botão "Remover imagem" novo. Remover só chama
 * `onChange("")` — a exclusão de verdade do arquivo no Storage já era
 * feita pelo `product-form.tsx` após salvar com sucesso (mesma lógica que
 * já tratava a troca de imagem), então "remover" não precisou de nenhuma
 * lógica nova, só de um jeito de zerar o campo.
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
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-4">
        <div className="relative aspect-square w-32 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted">
          {value ? (
            <Image src={value} alt="" fill sizes="128px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-muted to-muted/60">
              <ImageOff className="h-6 w-6 text-muted-foreground/40" strokeWidth={1.5} aria-hidden />
              <span className="text-[11px] text-muted-foreground/70">Sem foto</span>
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface/80 backdrop-blur-[1px]">
              <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
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
            {value ? "Trocar imagem" : "Selecionar imagem"}
          </Button>

          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange("")}
              disabled={disabled || isUploading}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Remover imagem
            </Button>
          )}

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
