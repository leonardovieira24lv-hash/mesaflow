"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Save, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RestaurantStatusBadge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { RestaurantLogoUpload } from "@/components/configuracoes/restaurant-logo-upload";
import { updateRestaurantSchema } from "@/lib/validations/restaurant";
import { ROUTES } from "@/constants/routes";
import type { Restaurant } from "@/types/domain";
import type { ApiError } from "@/types/api";

interface RestaurantSettingsFormProps {
  // Não altera `Restaurant` (`@/types/domain`) — os 13 campos cadastrais
  // da GD-02 são acrescentados aqui, só para este componente, para não
  // mexer em nenhum tipo compartilhado fora do escopo aprovado.
  restaurant: Restaurant & {
    tradeName: string | null;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    postalCode: string | null;
    street: string | null;
    streetNumber: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    instagram: string | null;
    facebook: string | null;
    website: string | null;
    // Identidade — Sprint "Perfil do Restaurante, Fase 1" (2026-08-09).
    logoUrl: string | null;
    description: string | null;
  };
}

interface RestaurantDto {
  id: string;
  name: string;
  slug: string;
  status: string;
  trade_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  postal_code: string | null;
  street: string | null;
  street_number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  instagram: string | null;
  facebook: string | null;
  website: string | null;
  logo_url: string | null;
  description: string | null;
}

// Chave de cada campo = exatamente o nome aceito pelo PATCH
// (`updateRestaurantSchema`/`route.ts`), evitando qualquer conversão
// camelCase↔snake_case na hora de montar o payload ou ler erros do Zod.
interface RegistrationFieldConfig {
  key: string;
  label: string;
  placeholder?: string;
  hint?: string;
  className?: string;
}

// `trade_name` saiu daqui na Sprint "Perfil do Restaurante, Fase 1" —
// passou a fazer parte da seção Identidade (junto com logo/nome/descrição),
// não mais de Contato (que agora é só telefone/whatsapp/e-mail).
const CONTACT_FIELDS: RegistrationFieldConfig[] = [
  { key: "phone", label: "Telefone", placeholder: "(11) 3333-4444" },
  { key: "whatsapp", label: "WhatsApp", placeholder: "(11) 99999-8888" },
  { key: "email", label: "E-mail", placeholder: "contato@restaurante.com" },
];

const ADDRESS_FIELDS: RegistrationFieldConfig[] = [
  { key: "postal_code", label: "CEP", placeholder: "00000-000", className: "font-mono" },
  { key: "street", label: "Rua", placeholder: "Ex.: Av. Paulista" },
  { key: "street_number", label: "Número", placeholder: "Ex.: 123" },
  { key: "neighborhood", label: "Bairro", placeholder: "Ex.: Centro" },
  { key: "city", label: "Cidade", placeholder: "Ex.: São Paulo" },
  { key: "state", label: "Estado (UF)", placeholder: "Ex.: SP", className: "w-20 font-mono uppercase" },
];

const SOCIAL_FIELDS: RegistrationFieldConfig[] = [
  { key: "instagram", label: "Instagram", placeholder: "@seurestaurante" },
  { key: "facebook", label: "Facebook", placeholder: "facebook.com/seurestaurante" },
  { key: "website", label: "Site", placeholder: "https://seurestaurante.com.br" },
];

/**
 * Tela de "Perfil do Restaurante" (contrato seção 4.2, estendido pela
 * GD-01/GD-02 com os 13 campos cadastrais, e pela Sprint "Perfil do
 * Restaurante, Fase 1" com logo/descrição). Segue o mesmo padrão de
 * formulário já usado em `CategoriesManager`/`ProductForm`: validação
 * client-side com o mesmo schema Zod do Route Handler (feedback imediato),
 * envio via `fetch` direto para `/api/v1/restaurant`, e `toast`/`FormField`
 * para os estados de sucesso e erro.
 *
 * Reorganizado em 4 seções (Sprint "Perfil do Restaurante, Fase 1",
 * 2026-08-09): Identidade (logo, nome, slug, nome fantasia, descrição),
 * Contato, Endereço, Redes sociais — mesma lógica de sempre, só reagrupada
 * visualmente. `trade_name` migrou do card de Contato para o de Identidade
 * nesta Sprint; nenhum outro campo mudou de lugar.
 *
 * Só envia no PATCH os campos que de fato mudaram — preserva o
 * comportamento parcial do contrato 4.2 (permite alterar só um campo, só
 * outro, ou vários de uma vez) e evita gerar um `409 CONFLICT` de slug por
 * reenviar o mesmo valor que já está salvo.
 *
 * Nome/Slug continuam com o fluxo próprio já existente (confirmação antes
 * de mudar o slug, por causa de QR Codes/links já impressos). Os demais
 * campos cadastrais (GD-02) e os novos de identidade (logo, descrição) não
 * têm esse risco — mudar telefone/endereço/redes sociais/logo/descrição não
 * invalida nada já impresso — então entram direto no mesmo `<form>`/mesmo
 * botão "Salvar alterações", sem diálogo de confirmação.
 */
export function RestaurantSettingsForm({ restaurant }: RestaurantSettingsFormProps) {
  const [name, setName] = useState(restaurant.name);
  const [slug, setSlug] = useState(restaurant.slug);

  // Baseline dos 13 campos cadastrais, direto da prop (mesmo raciocínio já
  // usado para `restaurant.name`/`restaurant.slug` no diff abaixo) — usado
  // só para comparação, nunca mutado.
  const initialFields: Record<string, string> = {
    trade_name: restaurant.tradeName ?? "",
    phone: restaurant.phone ?? "",
    whatsapp: restaurant.whatsapp ?? "",
    email: restaurant.email ?? "",
    postal_code: restaurant.postalCode ?? "",
    street: restaurant.street ?? "",
    street_number: restaurant.streetNumber ?? "",
    neighborhood: restaurant.neighborhood ?? "",
    city: restaurant.city ?? "",
    state: restaurant.state ?? "",
    instagram: restaurant.instagram ?? "",
    facebook: restaurant.facebook ?? "",
    website: restaurant.website ?? "",
    logo_url: restaurant.logoUrl ?? "",
    description: restaurant.description ?? "",
  };
  const [fields, setFields] = useState<Record<string, string>>(initialFields);

  function updateField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Diálogo de confirmação específico para mudança de slug — só aparece
  // quando o slug foi de fato alterado (ver `handleSubmit`), nunca para
  // uma edição só de nome.
  const [pendingSlugChange, setPendingSlugChange] = useState<Record<string, string> | null>(null);

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

  function buildPayload(): Record<string, string> | null {
    setErrors({});

    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();

    const payload: Record<string, string> = {};
    if (trimmedName !== restaurant.name) payload.name = trimmedName;
    if (trimmedSlug !== restaurant.slug) payload.slug = trimmedSlug;

    for (const [key, originalValue] of Object.entries(initialFields)) {
      const trimmedValue = (fields[key] ?? "").trim();
      if (trimmedValue !== originalValue) {
        payload[key] = trimmedValue;
      }
    }

    if (Object.keys(payload).length === 0) {
      toast.info("Nada para salvar", "Altere algum campo antes de salvar.");
      return null;
    }

    const result = updateRestaurantSchema.safeParse(payload);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = String(issue.path[0]);
        fieldErrors[field] = issue.message;
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
    // desta sprint), então o aviso é a proteção disponível hoje. Os 13
    // campos cadastrais (GD-02), mesmo que enviados junto no mesmo
    // `payload`, não têm esse risco — só o slug aciona este diálogo.
    if (payload.slug !== undefined) {
      setPendingSlugChange(payload);
      return;
    }

    void submit(payload);
  }

  async function submit(payload: Record<string, string>) {
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
      setFields({
        trade_name: updated.trade_name ?? "",
        phone: updated.phone ?? "",
        whatsapp: updated.whatsapp ?? "",
        email: updated.email ?? "",
        postal_code: updated.postal_code ?? "",
        street: updated.street ?? "",
        street_number: updated.street_number ?? "",
        neighborhood: updated.neighborhood ?? "",
        city: updated.city ?? "",
        state: updated.state ?? "",
        instagram: updated.instagram ?? "",
        facebook: updated.facebook ?? "",
        website: updated.website ?? "",
        logo_url: updated.logo_url ?? "",
        description: updated.description ?? "",
      });
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
            <span className="text-xs font-medium uppercase tracking-wide text-ds2-foreground-muted">Nome</span>
            <span className="font-medium">{restaurant.name}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-ds2-foreground-muted">Slug</span>
            <span className="font-mono">{restaurant.slug}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-ds2-foreground-muted">Status</span>
            <RestaurantStatusBadge status={restaurant.status} className="w-fit" />
          </div>
          {currentPublicUrl && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-ds2-foreground-muted">
                Cardápio público
              </span>
              <a
                href={currentPublicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-ds2-primary hover:underline"
              >
                {currentPublicUrl}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Identidade</CardTitle>
            <CardDescription>Logo, nome e descrição do restaurante.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField label="Logo" error={errors.logo_url} hint="Imagem quadrada — JPG, PNG ou WEBP, até 5 MB.">
              <RestaurantLogoUpload
                restaurantId={restaurant.id}
                value={fields.logo_url ?? ""}
                onChange={(url) => updateField("logo_url", url)}
                disabled={isSubmitting}
              />
            </FormField>

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
              <p className="rounded-ds2-sm bg-ds2-warning/10 px-3 py-2 text-xs text-ds2-warning">
                Alterar o slug muda a URL pública do cardápio. QR Codes já impressos e links já
                compartilhados com o slug atual (<span className="font-mono">{restaurant.slug}</span>)
                deixarão de funcionar e precisarão ser gerados/enviados de novo.
              </p>
            )}

            <FormField label="Nome fantasia" error={errors.trade_name}>
              <Input
                value={fields.trade_name}
                onChange={(e) => updateField("trade_name", e.target.value)}
                placeholder="Ex.: Zé Burger"
                disabled={isSubmitting}
              />
            </FormField>

            <FormField
              label="Descrição"
              error={errors.description}
              hint="Uma breve apresentação do restaurante. Até 1000 caracteres."
            >
              <Textarea
                value={fields.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Ex.: Hambúrgueres artesanais em ambiente descontraído, desde 2018."
                disabled={isSubmitting}
                rows={4}
              />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contato</CardTitle>
            <CardDescription>Canais de contato do restaurante.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {CONTACT_FIELDS.map((field) => (
              <FormField key={field.key} label={field.label} error={errors[field.key]}>
                <Input
                  value={fields[field.key]}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  disabled={isSubmitting}
                  className={field.className}
                />
              </FormField>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Endereço</CardTitle>
            <CardDescription>Endereço físico do restaurante.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {ADDRESS_FIELDS.map((field) => (
              <FormField key={field.key} label={field.label} error={errors[field.key]}>
                <Input
                  value={fields[field.key]}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  disabled={isSubmitting}
                  className={field.className}
                />
              </FormField>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Redes sociais</CardTitle>
            <CardDescription>Links exibidos aos clientes, quando aplicável.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {SOCIAL_FIELDS.map((field) => (
              <FormField key={field.key} label={field.label} error={errors[field.key]}>
                <Input
                  value={fields[field.key]}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  disabled={isSubmitting}
                  className={field.className}
                />
              </FormField>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" isLoading={isSubmitting}>
            <Save className="h-4 w-4" />
            Salvar alterações
          </Button>
        </div>
      </form>

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
