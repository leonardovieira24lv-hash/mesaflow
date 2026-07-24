"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Save, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RestaurantStatusBadge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { updateRestaurantSchema } from "@/lib/validations/restaurant";
import { ROUTES } from "@/constants/routes";
import type { Restaurant } from "@/types/domain";
import type { ApiError } from "@/types/api";

interface RestaurantSettingsFormProps {
  restaurant: Restaurant;
}

interface RestaurantDto {
  id: string;
  name: string;
  slug: string;
  status: string;
}

/**
 * Tela de Configurações do Restaurante (contrato seção 4.2). Segue o mesmo
 * padrão de formulário já usado em `CategoriesManager`/`ProductForm`:
 * validação client-side com o mesmo schema Zod do Route Handler (feedback
 * imediato), envio via `fetch` direto para `/api/v1/restaurant`, e
 * `toast`/`FormField` para os estados de sucesso e erro.
 *
 * Só envia no PATCH os campos que de fato mudaram — preserva o
 * comportamento parcial do contrato 4.2 (permite alterar só o nome, só o
 * slug, ou os dois) e evita gerar um `409 CONFLICT` de slug por reenviar o
 * mesmo valor que já está salvo.
 */
export function RestaurantSettingsForm({ restaurant }: RestaurantSettingsFormProps) {
  const [name, setName] = useState(restaurant.name);
  const [slug, setSlug] = useState(restaurant.slug);
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Diálogo de confirmação específico para mudança de slug — só aparece
  // quando o slug foi de fato alterado (ver `handleSubmit`), nunca para
  // uma edição só de nome.
  const [pendingSlugChange, setPendingSlugChange] = useState<{
    name?: string;
    slug?: string;
  } | null>(null);

  // A URL pública depende do `origin` do navegador — gerada no cliente,
  // mesmo padrão já usado para os QR Codes (`table-qr-modal.tsx`,
  // `table-qr-code.tsx`). Evita acoplar este componente a `headers()` do
  // Server Component só para montar uma string de exibição.
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const currentPublicUrl = origin ? `${origin}${ROUTES.clienteMenu(restaurant.slug)}` : null;
  const slugChanged = slug.trim() !== restaurant.slug;

  function buildPayload(): { name?: string; slug?: string } | null {
    setErrors({});

    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();

    const payload: { name?: string; slug?: string } = {};
    if (trimmedName !== restaurant.name) payload.name = trimmedName;
    if (trimmedSlug !== restaurant.slug) payload.slug = trimmedSlug;

    if (Object.keys(payload).length === 0) {
      toast.info("Nada para salvar", "Altere o nome ou o slug antes de salvar.");
      return null;
    }

    const result = updateRestaurantSchema.safeParse(payload);
    if (!result.success) {
      const fieldErrors: { name?: string; slug?: string } = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (field === "name" || field === "slug") {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return null;
    }

    return payload;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const payload = buildPayload();
    if (!payload) return;

    // Mudar o slug invalida QR Codes já impressos e qualquer link
    // compartilhado com o cliente final — pede confirmação explícita antes
    // de prosseguir (item 4 desta sprint). Não há, nesta v1, nenhum
    // mecanismo de redirecionamento do slug antigo para o novo (mudaria o
    // contrato/arquitetura de resolução pública por slug — fora do escopo
    // desta sprint), então o aviso é a proteção disponível hoje.
    if (payload.slug !== undefined) {
      setPendingSlugChange(payload);
      return;
    }

    void submit(payload);
  }

  async function submit(payload: { name?: string; slug?: string }) {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/v1/restaurant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();

      if (!response.ok) {
        const apiError = body as ApiError;
        if (apiError.error?.code === "CONFLICT") {
          setErrors((prev) => ({ ...prev, slug: apiError.error.message }));
        } else if (apiError.error?.code === "FORBIDDEN") {
          toast.error(
            "Você não tem permissão para isso",
            "Apenas o proprietário do restaurante pode alterar estes dados.",
          );
        } else {
          toast.error("Não foi possível salvar", apiError.error?.message);
        }
        setIsSubmitting(false);
        return;
      }

      const updated = body.data as RestaurantDto;
      setName(updated.name);
      setSlug(updated.slug);
      toast.success("Configurações salvas");
      setIsSubmitting(false);
      setPendingSlugChange(null);
    } catch {
      toast.error("Não foi possível conectar", "Verifique sua internet e tente novamente.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Informações atuais</CardTitle>
          <CardDescription>Dados do restaurante ativos agora, antes de qualquer alteração.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nome</span>
            <span className="font-medium">{restaurant.name}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Slug</span>
            <span className="font-mono">{restaurant.slug}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</span>
            <RestaurantStatusBadge status={restaurant.status} className="w-fit" />
          </div>
          {currentPublicUrl && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Cardápio público
              </span>
              <a
                href={currentPublicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {currentPublicUrl}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Editar restaurante</CardTitle>
          <CardDescription>Altere o nome e/ou o slug usado nas URLs públicas e nos QR Codes.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <FormField label="Nome do restaurante" error={errors.name} required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Restaurante do Zé"
                disabled={isSubmitting}
              />
            </FormField>

            <FormField
              label="Slug"
              error={errors.slug}
              hint="Usado na URL pública do cardápio e nos QR Codes das mesas. Somente letras minúsculas, números e hífen."
              required
            >
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="Ex.: restaurante-do-ze"
                disabled={isSubmitting}
                className="font-mono"
              />
            </FormField>

            {slugChanged && (
              <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
                Alterar o slug muda a URL pública do cardápio. QR Codes já impressos e links já
                compartilhados com o slug atual (<span className="font-mono">{restaurant.slug}</span>)
                deixarão de funcionar e precisarão ser gerados/enviados de novo.
              </p>
            )}

            <div className="flex justify-end">
              <Button type="submit" isLoading={isSubmitting}>
                <Save className="h-4 w-4" />
                Salvar alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(pendingSlugChange)}
        onOpenChange={(open) => !open && setPendingSlugChange(null)}
        title="Confirmar mudança de slug"
        description={`O slug atual (${restaurant.slug}) será substituído por "${pendingSlugChange?.slug}". QR Codes já impressos e links já compartilhados com o slug atual deixarão de funcionar imediatamente. Esta ação não pode ser desfeita automaticamente — você pode alterar o slug de volta depois, mas os QR Codes precisarão ser gerados novamente de qualquer forma.`}
        variant="destructive"
        confirmLabel="Sim, alterar slug"
        onConfirm={() => pendingSlugChange && void submit(pendingSlugChange)}
        isConfirming={isSubmitting}
      />
    </div>
  );
}
