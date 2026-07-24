"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { ROUTES } from "@/constants/routes";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "E-mail inválido.");
      return;
    }
    setIsSubmitting(true);

    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(result.data.email, {
      redirectTo: `${window.location.origin}${ROUTES.redefinirSenha}`,
    });

    // Por segurança, sempre mostramos a mesma confirmação, exista ou não a
    // conta — nunca revelar se um e-mail está cadastrado (mesmo em caso de
    // erro do Supabase, o usuário não deve saber o motivo exato).
    setIsSubmitting(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
          <MailCheck className="h-6 w-6 text-success" aria-hidden />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-xl font-semibold">Verifique seu e-mail</h1>
          <p className="text-sm text-muted-foreground">
            Se houver uma conta cadastrada para <strong>{email}</strong>, enviamos um link para
            redefinir sua senha.
          </p>
        </div>
        <Link
          href={ROUTES.login}
          className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold">Esqueci minha senha</h1>
        <p className="text-sm text-muted-foreground">
          Informe o e-mail da sua conta para receber um link de redefinição.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">{error}</Alert>
      )}

      <FormField label="E-mail">
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

      <Button type="submit" isLoading={isSubmitting} className="w-full">
        Enviar link de redefinição
      </Button>

      <Link
        href={ROUTES.login}
        className="flex items-center justify-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para o login
      </Link>
    </form>
  );
}
