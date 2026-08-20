"use client";

import { useState, type FormEvent } from "react";
import { Layers } from "lucide-react";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ProductImageUpload } from "@/components/cardapio/product-image-upload";
import { OptionGroupsManager } from "@/components/cardapio/option-groups-manager";
import { deleteProductImage } from "@/lib/storage/product-images";
import { createMenuItemSchema, updateMenuItemSchema } from "@/lib/validations/menu";
import type { MenuCategory, MenuItem } from "@/types/domain";
import type { ApiError } from "@/types/api";
import { getMenuSetupGuide } from "@/lib/business-type";
import type { BusinessType } from "@/lib/business-type";
import { menuItemFromDto, type MenuItemDto } from "@/types/menu-item-dto";

interface ProductFormProps {
  categories: MenuCategory[];
  /** Necessário para montar o caminho do upload (`{restaurantId}/products/...`) — o RLS do bucket exige esse prefixo. */
  restaurantId: string;
  /** Presente em modo de edição; ausente em criação. */
  item?: MenuItem;
  /** Sprint "Refatoração da Experiência do Cardápio": pré-seleciona a categoria ao criar a partir do "+ Adicionar Produto" de uma seção específica. Ignorado em edição (usa `item.categoryId`). */
  defaultCategoryId?: string;
  /** Perfil do negócio, propagado até os grupos de opções para contextualizar exemplos e textos. */
  businessType?: BusinessType | string | null;
  onSaved: (item: MenuItem) => void;
  onCancel: () => void;
}

/**
 * Formulário de Produto (contrato seções 6.2/6.4) — mesmo componente serve
 * para criar (modal, em `<CardapioManager>`) e editar (modal ou página de
 * detalhe standalone em `/cardapio/produtos/[id]`, que continua existindo
 * como link direto — Sprint "Refatoração da Experiência do Cardápio",
 * 2026-07-28),
 * trocando só o método/URL da chamada com base na presença de `item`.
 *
 * Sprint "Upload de Imagens dos Produtos" (2026-07-28): `image_url` deixou
 * de ser um campo de texto — agora é preenchido por `<ProductImageUpload>`,
 * que já faz o upload de verdade e devolve a URL pública. O contrato da API
 * não mudou em nada (`image_url` continua uma string comum no payload). Ao
 * salvar uma edição com sucesso e a imagem tiver mudado, a imagem antiga é
 * removida do Storage *depois* da confirmação de salvamento — nunca antes,
 * para não perder a imagem antiga caso o usuário cancele o formulário
 * depois de já ter trocado a foto.
 */
export function ProductForm({ categories, restaurantId, item, defaultCategoryId, businessType, onSaved, onCancel }: ProductFormProps) {
  const isEditing = Boolean(item);
  const originalImageUrl = item?.imageUrl;

  const [categoryId, setCategoryId] = useState(item?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? "");
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

      const savedItem = menuItemFromDto(body.data as MenuItemDto);

      // Remove a imagem antiga do Storage só depois do salvamento confirmado
      // — evita apagar uma imagem que ainda está em uso caso algo falhe
      // antes disso. Silencioso: uma falha aqui não deve impedir o produto
      // de ser salvo (o pior caso é um arquivo órfão, não um dado perdido).
      if (originalImageUrl && originalImageUrl !== savedItem.imageUrl) {
        void deleteProductImage(originalImageUrl);
      }

      onSaved(savedItem);
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
          placeholder={`Ex.: ${getMenuSetupGuide(businessType).productExample.split(",")[0]?.trim() || "Seu produto"}`}
          disabled={isSubmitting}
        />
      </FormField>

      <FormField label="Descrição" error={errors.description} hint="Opcional">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={`Ex.: ${businessType === "acai" ? "Açaí com leite em pó e morango." : businessType === "pizza" ? "Massa, molho, queijo e ingredientes do sabor." : businessType === "burger" ? "Pão, carne, queijo e acompanhamentos." : "Descrição do produto e seus principais ingredientes."}`}
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

      <div className="flex flex-col gap-1.5">
        <Label>Foto do produto</Label>
        <ProductImageUpload
          restaurantId={restaurantId}
          value={imageUrl}
          onChange={setImageUrl}
          disabled={isSubmitting}
        />
        {errors.image_url && <p className="text-xs font-medium text-destructive">{errors.image_url}</p>}
      </div>

      <div className="flex items-center gap-3">
        <Switch id="is-available" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
        <Label htmlFor="is-available" className="cursor-pointer">
          Disponível para pedidos
        </Label>
      </div>

      {/* Parada técnica — reorganização do fluxo de Cardápio (2026-08-14):
          opcional vinculado a ESTE produto específico (ex.: "Ponto da
          carne" só no X-Tudo, não a categoria Lanches inteira) — antes
          ficava escondido na aba "Grupos de opção" antiga, sem nenhuma
          pista visual de que existia. Só aparece editando um produto já
          salvo: produto novo ainda não tem `item.id` pra vincular o
          grupo (a opção pertence ao PRODUTO, precisa existir primeiro). */}
      {isEditing && item && (
        <div className="flex flex-col gap-2 rounded-ds2-lg bg-ds2-danger/[0.04] p-3 ring-1 ring-ds2-danger/10">
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-ds2-danger" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wide text-ds2-danger">
              Opcionais só deste produto
            </span>
          </div>
          <p className="text-xs text-ds2-foreground-muted">
            Além dos opcionais da categoria inteira — use aqui só quando for algo exclusivo deste produto.
          </p>
          <OptionGroupsManager filterMenuItemId={item.id} businessType={businessType} compact />
        </div>
      )}

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
