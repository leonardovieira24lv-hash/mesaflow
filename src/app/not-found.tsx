import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="text-sm text-muted-foreground">O link acessado não existe ou expirou.</p>
      <Link href="/login" className="text-sm font-medium text-primary underline">
        Voltar para o início
      </Link>
    </div>
  );
}
