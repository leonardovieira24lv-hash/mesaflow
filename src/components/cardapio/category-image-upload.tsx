"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { ImageOff, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { uploadCategoryImage, validateCategoryImageFile, CategoryImageError } from "@/lib/storage/category-images";

interface CategoryImageUploadProps {
  restaurantId: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

/**
 * Campo "Foto" do formulário de categoria (2026-08-15, simplificado
 * 2026-08-16) — upload DIRETO, sem etapa de recorte.
 *
 * Histórico: a 1ª versão abria um editor de recorte (`<ImageCropEditor>`)
 * dentro do próprio modal de categoria — um `<dialog>` nativo aninhado
 * dentro de outro `<dialog>` nativo já aberto. 3 tentativas de correção
 * (trocar por div comum, endurecer o clique do backdrop, portar pro
 * mesmo dialog via Context) não resolveram de vez um bug real de
 * navegador com dois `<dialog>` empilhados — confirmado com vídeo de
 * tela, a foto nunca persistia. Decisão do dono: "chega, tenta outro
 * modelo" — pra um avatar pequeno e decorativo (círculo de categoria,
 * bem diferente da foto principal de um produto), abrir mão do recorte
 * fino elimina o bug pela raiz em vez de insistir em contornar. Upload
 * do arquivo original, `object-cover` no CSS já centraliza o quanto dá
 * sozinho — se ficar um pouco fora de centro às vezes, é um preço aceito
 * de propósito, não um bug.
 */
export function CategoryImageUpload({ restaurantId, value, onChange, disabled }: CategoryImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    try {
      validateCategoryImageFile(file);
    } catch (err) {
      setError(err instanceof CategoryImageError ? err.message : "Não foi possível abrir essa imagem.");
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadCategoryImage(restaurantId, file);
      onChange(url);
    } catch (err) {
      setError(
        err instanceof CategoryImageError ? err.message : "Não foi possível enviar a imagem. Tente novamente.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-ds2-border bg-ds2-surface-hover">
          {value ? (
            <Image src={value} alt="" fill sizes="80px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-ds2-surface-hover to-ds2-surface-hover/60">
              <ImageOff className="h-5 w-5 text-ds2-foreground-muted/40" strokeWidth={1.5} aria-hidden />
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-ds2-surface/80 backdrop-blur-[1px]">
              <Loader2 className="h-5 w-5 animate-spin text-ds2-primary" aria-hidden />
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
              className="text-ds2-danger hover:text-ds2-danger"
            >
              <Trash2 className="h-4 w-4" />
              Remover imagem
            </Button>
          )}

          <p className="text-xs text-ds2-foreground-muted">
            Opcional — sem foto própria, usamos a do 1º produto da categoria.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Selecionar imagem da categoria"
      />

      {error && <Alert variant="destructive">{error}</Alert>}
    </div>
  );
}
