"use client";

import { useState, type FormEvent } from "react";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { createMenuItemSchema, updateMenuItemSchema } from "@/lib/validations/menu";
import type { MenuCategory, MenuItem } from "@/types/domain";
import type { ApiError } from "@/types/api";

interface ItemDto {
  id: string;
  category_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available: boolean;
}

export function itemFromDto(dto: ItemDto): MenuItem {
  return {
    id: dto.id,
    categoryId: dto.category_id,
    name: dto.name,
    description: dto.description,
    price: dto.price,
    imageUrl: dto.image_url,
    isAvailable: dto.is_available,
  };
}

interface ProductFormProps {
  categories: MenuCategory[];
  /** Presente em modo de edição; ausente em criação. */
  item?: MenuItem;
  onSaved: (item: MenuItem) => void;
  onCancel: () => void;
}

/**
 * Formulário de Produto (contrato seções 6.2/6.4) — mesmo componente serve
 * para criar (modal, em `<ProductsList>`) e editar (página de detalhe),
 * trocando só o método/URL da chamada com base na presença de `item`.
 *
 * `image_url` aqui é um campo de texto simples: o contrato já define o
 * campo como "resultado de upload prévio no Supabase Storage" — o upload em
 * si é um fluxo separado (fora do escopo desta sprint de CRUD de Cardápio).
 */
export function ProductForm({ categories, item, onSaved, onCancel }: ProductFormProps) {
  const isEditing = Boolean(item);

  const [categoryId, setCategoryId] = useState(item?.categoryId ?? categories[0]?.id ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(item?.price !== undefined ? String(item.price) : "");
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? "");
  const [isAvailable, setIsAvailable] = useState(item?.isAvailable ?? true);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setErrors({});

    const payload = {
      category_id: categoryId,
      name,
      description: description || undefined,
      price: price === "" ? undefined : Number(price),
      image_url: imageUrl || undefined,
      is_available: isAvailable,
    };

    const schema = isEditing ? updateMenuItemSchema : createMenuItemSchema;
    const result = schema.safeParse(payload);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path.join(".");
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(isEditing ? `/api/v1/menu/items/${item!.id}` : "/api/v1/menu/items", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      const body = await response.json();

      if (!response.ok) {
        const apiError = body as ApiError;
        setFormError(apiError.error?.message ?? "Não foi possível salvar o produto.");
        setIsSubmitting(false);
        return;
      }

      onSaved(itemFromDto(body.data as ItemDto));
      setIsSubmitting(false);
    } catch {
      setFormError("Não foi possível conectar. Verifique sua internet e tente novamente.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {formError && (
        <Alert variant="destructive">{formError}</Alert>
      )}

      <FormField label="Categoria" error={errors.category_id} required>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={isSubmitting}>
          {categories.length === 0 && <option value="">Nenhuma categoria cadastrada</option>}
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Nome do produto" error={errors.name} required>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: X-Burger"
          disabled={isSubmitting}
        />
      </FormField>

      <FormField label="Descrição" error={errors.description} hint="Opcional">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex.: Pão brioche, hambúrguer 150g, queijo e maionese da casa."
          disabled={isSubmitting}
        />
      </FormField>

      <FormField label="Preço (R$)" error={errors.price} required>
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Ex.: 24.90"
          disabled={isSubmitting}
        />
      </FormField>

      <FormField label="URL da imagem" error={errors.image_url} hint="Opcional — link de uma imagem já hospedada">
        <Input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://..."
          disabled={isSubmitting}
        />
      </FormField>

      <div className="flex items-center gap-3">
        <Switch id="is-available" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
        <Label htmlFor="is-available" className="cursor-pointer">
          Disponível para pedidos
        </Label>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isSubmitting} disabled={categories.length === 0}>
          {isEditing ? "Salvar" : "Criar produto"}
        </Button>
      </div>
    </form>
  );
}
