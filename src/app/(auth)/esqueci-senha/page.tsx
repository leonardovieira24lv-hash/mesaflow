import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = { title: "Esqueci minha senha" };

export default function EsqueciSenhaPage() {
  return (
    <div className="w-full max-w-sm">
      <ForgotPasswordForm />
    </div>
  );
}
