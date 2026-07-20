import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { PageLoading } from "@/components/ui/spinner";

export const metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm">
      {/* useSearchParams() dentro do LoginForm exige Suspense em build estático. */}
      <Suspense fallback={<PageLoading />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
