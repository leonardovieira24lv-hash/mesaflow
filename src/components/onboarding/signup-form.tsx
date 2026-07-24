"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { User, Building2, Mail, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { setOnboardingSlug } from "@/lib/onboarding-session";
import { createRestaurantSchema } from "@/lib/validations/onboarding";
import { ROUTES } from "@/constants/routes";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import type { ApiError } from "@/types/api";

type FieldErrors = Partial<Record<"owner_name" | "restaurant_name" | "email" | "password" | "confirmPassword", string>>;

/** Passo 1 do onboarding: cria a conta do proprietário + o restaurante (contrato seção 2.1). */
export function SignupForm() {
  const router = useRouter();

  const [form, setForm] = useState({
    owner_name: "",
    restaurant_name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const result = createRestaurantSchema.safeParse(form);
    const fieldErrors: FieldErrors = {};

    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
    }
    if (form.password !== form.confirmPassword) {
      fieldErrors.confirmPassword = "As senhas não coincidem.";
    }
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/onboarding/restaurant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_name: form.owner_name,
          restaurant_name: form.restaurant_name,
          email: form.email,
          password: form.password,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        const apiError = body as ApiError;
        setFormError(apiError.error?.message ?? "Não foi possível criar sua conta. Tente novamente.");
        setIsSubmitting(false);
        return;
      }

      const { restaurant, session } = body.data as {
        restaurant: { slug: string };
        session: { access_token: string; refresh_token: string };
      };
      setOnboardingSlug(restaurant.slug);

      // Persiste a sessão recém-emitida no cliente (cookies via @supabase/ssr)
      // para que o próximo passo (criação de mesas) já chegue autenticado.
      const supabase = createClient();
      await supabase.auth.setSession(session);

      router.refresh();
      router.push(ROUTES.onboardingMesas);
    } catch {
      setFormError("Não foi possível conectar. Verifique sua internet e tente novamente.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <OnboardingProgress current={1} />
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="font-display text-2xl font-semibold">Crie sua conta no MesaFlow</h1>
          <p className="text-sm text-muted-foreground">Leva menos de 2 minutos para começar.</p>
        </div>

        {formError && (
          <Alert variant="destructive">{formError}</Alert>
        )}

        <FormField label="Seu nome" error={errors.owner_name}>
          <Input
            leadingIcon={<User />}
            placeholder="Ex.: Maria Silva"
            value={form.owner_name}
            onChange={(e) => update("owner_name", e.target.value)}
            disabled={isSubmitting}
          />
        </FormField>

        <FormField label="Nome do restaurante" error={errors.restaurant_name}>
          <Input
            leadingIcon={<Building2 />}
            placeholder="Ex.: Restaurante Sabor Caseiro"
            value={form.restaurant_name}
            onChange={(e) => update("restaurant_name", e.target.value)}
            disabled={isSubmitting}
          />
        </FormField>

        <FormField label="E-mail" error={errors.email}>
          <Input
            type="email"
            autoComplete="email"
            leadingIcon={<Mail />}
            placeholder="voce@restaurante.com"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            disabled={isSubmitting}
          />
        </FormField>

        <FormField label="Senha" error={errors.password}>
          <Input
            type="password"
            autoComplete="new-password"
            leadingIcon={<Lock />}
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            disabled={isSubmitting}
          />
        </FormField>

        <FormField label="Confirmar senha" error={errors.confirmPassword}>
          <Input
            type="password"
            autoComplete="new-password"
            leadingIcon={<Lock />}
            placeholder="••••••••"
            value={form.confirmPassword}
            onChange={(e) => update("confirmPassword", e.target.value)}
            disabled={isSubmitting}
          />
        </FormField>

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Criar conta e continuar
        </Button>
      </form>
    </div>
  );
}
