import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = { title: "Redefinir senha" };

export default function RedefinirSenhaPage() {
  return (
    <div className="w-full max-w-sm">
      <ResetPasswordForm />
    </div>
  );
}
