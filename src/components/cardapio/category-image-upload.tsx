"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { ImageOff, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ImageCropEditor } from "@/components/cardapio/image-crop-editor";
import { uploadCroppedCategoryImage, validateCategoryImageFile, CategoryImageError } from "@/lib/storage/category-images";

interface CategoryImageUploadProps {
  restaurantId: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

/**
 * Campo "Foto" do formulário de categoria (2026-08-15) — mesmo componente
 * de recorte (`<ImageCropEditor>`, genérico) e mesmo fluxo de
 * `product-image-upload.tsx` (seleciona → valida → recorta → sobe pro
 * Storage), só trocando o helper de upload por
 * `lib/storage/category-images.ts`. Opcional de propósito — nem todo dono
 * de restaurante vai querer cuidar disso categoria por categoria; sem
 * foto própria, o Cardápio Público recorre a um fallback (ver
 * `category-nav.tsx`).
 */
export function CategoryImageUpload({ restaurantId, value, onChange, disabled }: CategoryImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    try {
      validateCategoryImageFile(file);
      setPendingFile(file);
    } catch (err) {
      setError(err instanceof CategoryImageError ? err.message : "Não foi possível abrir essa imagem.");
    }
  }

  async function handleCropSave(blob: Blob) {
    setIsUploading(true);
    setError(null);
    try {
      const url = await uploadCroppedCategoryImage(restaurantId, blob);
      onChange(url);
      setPendingFile(null);
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

      <ImageCropEditor
        open={pendingFile !== null}
        file={pendingFile}
        onCancel={() => setPendingFile(null)}
        onSave={handleCropSave}
        isSaving={isUploading}
      />
    </div>
  );
}
