"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mapAuthError } from "@/lib/auth/error-messages";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { ROUTES } from "@/constants/routes";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";

type FieldErrors = Partial<Record<"password" | "confirmPassword", string>>;
type LinkStatus = "checking" | "ready" | "invalid";

/**
 * Tela de destino do link de e-mail de redefinição. O Supabase troca o
 * token da URL por uma sessão de recuperação automaticamente
 * (`detectSessionInUrl`, ativo por padrão no client de browser); aqui só
 * escutamos o evento `PASSWORD_RECOVERY` para saber quando é seguro mostrar
 * o formulário.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [status, setStatus] = useState<LinkStatus>("checking");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setStatus("ready");
      }
    });

    // Cobre o caso de a sessão de recuperação já ter sido processada antes
    // deste componente montar (ex.: navegação rápida) — sem isso, o
    // formulário ficaria preso em "checking" para sempre.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setStatus("ready");
    });

    const timeout = setTimeout(() => {
      setStatus((current) => (current === "checking" ? "invalid" : current));
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const result = resetPasswordSchema.safeParse({ password, confirmPassword });
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
    const { error } = await supabase.auth.updateUser({ password: result.data.password });

    if (error) {
      setIsSubmitting(false);
      setFormError(mapAuthError(error));
      return;
    }

    // Encerra a sessão de recuperação e manda para o login "limpo" — evita
    // deixar uma sessão implícita aberta após uma troca de senha sensível.
    await supabase.auth.signOut();
    toast.success("Senha redefinida", "Você já pode entrar com sua nova senha.");
    router.push(ROUTES.login);
  }

  if (status === "checking") {
    return <PageLoading label="Verificando link" />;
  }

  if (status === "invalid") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-display text-xl font-semibold">Link inválido ou expirado</h1>
        <p className="text-sm text-muted-foreground">
          Solicite um novo link de redefinição de senha e tente novamente.
        </p>
        <Button onClick={() => router.push(ROUTES.esqueciSenha)}>Solicitar novo link</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold">Criar nova senha</h1>
        <p className="text-sm text-muted-foreground">Escolha uma nova senha para sua conta.</p>
      </div>

      {formError && (
        <Alert variant="destructive">{formError}</Alert>
      )}

      <FormField label="Nova senha" error={errors.password}>
        <Input
          type="password"
          autoComplete="new-password"
          leadingIcon={<Lock />}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isSubmitting}
        />
      </FormField>

      <FormField label="Confirmar nova senha" error={errors.confirmPassword}>
        <Input
          type="password"
          autoComplete="new-password"
          leadingIcon={<Lock />}
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isSubmitting}
        />
      </FormField>

      <Button type="submit" isLoading={isSubmitting} className="w-full">
        Redefinir senha
      </Button>
    </form>
  );
}
