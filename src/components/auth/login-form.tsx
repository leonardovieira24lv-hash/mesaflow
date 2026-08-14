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

/**
 * Etapa 2 — Redesign Visual do Login (2026-08-12). Lógica de autenticação
 * 100% preservada (`signInWithPassword`, `mapAuthError`, `redirectTo`,
 * validação, loading, erro) — só `className`/estrutura visual mudaram, e
 * a adição da logo/card no topo do JSX.
 *
 * Card visual real (`bg-background` + `border-border` + `elevation-card`)
 * envolvendo o que antes era só um `<form>` solto na página — mesmos
 * tokens/classe já usados no Cardápio Público (Etapas 3C/3G), reaproveitados
 * aqui, não uma linguagem visual nova.
 *
 * Logo (`/logo-forko-stacked.png`) — asset oficial fornecido, salvo no
 * projeto nesta mesma etapa; não desenhada/recriada em CSS.
 *
 * Vermelho Forko (`#E63946`) aplicado só ao botão "Entrar" e ao link
 * "Esqueci minha senha", via classe local (`!bg-[#E63946]` etc.) — não
 * via `variant` do `<Button>` global, que usa `ds2-primary` (hoje verde
 * do Cardápio fora do painel administrativo, achado da Etapa 1 desta
 * mesma Sprint). `button.tsx`/`input.tsx`/`ds2-primary` global
 * intencionalmente intocados, como pedido — a cor de marca fica 100%
 * contida a este arquivo.
 */
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
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-background p-8 elevation-card">
      {/* eslint-disable-next-line @next/next/no-img-element -- proporção fixa conhecida, sem next/image por simplicidade (mesmo padrão já usado nas logos do Cardápio/painel). */}
      <img src="/logo-forko-stacked.png" alt="Forko" className="h-16 w-auto" />

      <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold text-foreground">Entrar</h1>
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
            className="focus-visible:!border-[#E63946] focus-visible:!ring-[#E63946]"
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
            className="focus-visible:!border-[#E63946] focus-visible:!ring-[#E63946]"
          />
        </FormField>

        <div className="flex justify-end">
          <Link href={ROUTES.esqueciSenha} className="text-sm font-medium text-[#E63946] hover:underline">
            Esqueci minha senha
          </Link>
        </div>

        {/* Vermelho Forko (`#E63946`) localizado só a este botão, via
            classe com `!important` — `variant="primary"` do <Button>
            global usa `bg-ds2-primary` (hoje verde do Cardápio fora do
            painel administrativo, achado da auditoria da Etapa 1), e o
            escopo desta Sprint proíbe tocar em `button.tsx` ou em
            `ds2-primary` globalmente. `!bg-[...]` sobrescreve com
            segurança, sem depender de nenhum token/componente
            compartilhado — mudança 100% contida a esta tela. */}
        <Button
          type="submit"
          isLoading={isSubmitting}
          className="w-full !bg-[#E63946] hover:!bg-[#c62d38] focus-visible:!ring-[#E63946]"
        >
          Entrar
        </Button>
      </form>
    </div>
  );
}
