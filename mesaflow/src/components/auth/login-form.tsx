"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import Link from "next/link";
import { Mail, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mapAuthError } from "@/lib/auth/error-messages";
import { loginSchema } from "@/lib/validations/auth";
import { ROUTES } from "@/constants/routes";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type FieldErrors = Partial<Record<"email" | "password", string>>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // `redirect_to` vem do middleware (middleware.ts: "redirect_to" = pathname
  // que o usuário tentou acessar antes de ser redirecionado ao login), mas
  // chega aqui como parâmetro de URL — ou seja, é `string | null` em tempo
  // de execução, nunca uma rota literal conhecida em tempo de compilação.
  // Com `typedRoutes: true` (next.config.mjs), `router.push` exige um
  // `Route` — daí o erro de build. Resolver só com `as Route` seria
  // suficiente para o TypeScript, mas deixaria passar um open redirect (ex.:
  // `?redirect_to=https://site-malicioso.com` ou `//site-malicioso.com`).
  // Por isso a validação abaixo aceita apenas caminhos internos (começam
  // com um único "/") antes do cast — o `as Route` fica seguro porque, a
  // essa altura, o valor já foi restringido ao formato que o app conhece.
  const rawRedirectTo = searchParams.get("redirect_to");
  const redirectTo = (
    rawRedirectTo && rawRedirectTo.startsWith("/") && !rawRedirectTo.startsWith("//")
      ? rawRedirectTo
      : ROUTES.dashboard
  ) as Route;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(result.data);

    if (error) {
      setIsSubmitting(false);
      setFormError(mapAuthError(error));
      return;
    }

    // Garante que Server Components/middleware enxerguem a sessão recém-criada
    // antes de navegar para uma rota protegida.
    router.refresh();
    router.push(redirectTo);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold">Entrar</h1>
        <p className="text-sm text-muted-foreground">Acesse o painel do seu restaurante.</p>
      </div>

      {formError && (
        <Alert variant="destructive">{formError}</Alert>
      )}

      <FormField label="E-mail" error={errors.email}>
        <Input
          type="email"
          autoComplete="email"
          leadingIcon={<Mail />}
          placeholder="voce@restaurante.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isSubmitting}
        />
      </FormField>

      <FormField label="Senha" error={errors.password}>
        <Input
          type="password"
          autoComplete="current-password"
          leadingIcon={<Lock />}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isSubmitting}
        />
      </FormField>

      <div className="flex justify-end">
        <Link href={ROUTES.esqueciSenha} className="text-sm font-medium text-primary hover:underline">
          Esqueci minha senha
        </Link>
      </div>

      <Button type="submit" isLoading={isSubmitting} className="w-full">
        Entrar
      </Button>
    </form>
  );
}
