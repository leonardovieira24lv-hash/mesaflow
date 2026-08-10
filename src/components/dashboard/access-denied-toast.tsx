"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Route } from "next";
import { toast } from "@/components/ui/toast";

/**
 * Fase 3 — Gestão de Equipe (2026-08-09, encerramento). `configuracoes/page.tsx`
 * já bloqueia `staff` com um `redirect()` no servidor — mas um redirect puro
 * não explica *por quê* a pessoa voltou pro Dashboard sem querer. Este
 * componente lê o parâmetro `?blocked=` que o redirect agora inclui, mostra
 * um toast explicando, e limpa a URL (`router.replace`, sem novo histórico)
 * pra um F5 não repetir o aviso.
 *
 * Só cobre o caso de Configurações por enquanto — é a única área hoje
 * bloqueada por `role`. Se outra área ganhar essa mesma proteção no futuro,
 * o padrão `?blocked=<nome>` já dá pra reaproveitar, mudando só a mensagem.
 */
export function AccessDeniedToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const blocked = searchParams.get("blocked");

  useEffect(() => {
    if (blocked !== "configuracoes") return;

    toast.error("Acesso restrito", "Somente o proprietário do restaurante pode acessar essa área.");
    router.replace(pathname as Route);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só deve rodar quando `blocked` muda, não a cada render de `router`/`pathname`.
  }, [blocked]);

  return null;
}
