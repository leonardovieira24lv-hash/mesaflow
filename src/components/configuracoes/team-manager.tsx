"use client";

import { useState, type FormEvent } from "react";
import { Users, UserPlus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { createStaffSchema } from "@/lib/validations/team";
import type { TeamMember } from "@/lib/team/get-team-members";
import type { ApiError } from "@/types/api";

interface TeamManagerProps {
  initialTeam: TeamMember[];
}

/**
 * Gestão de Equipe (Fase 3, 2026-08-09) — `Configurações → Equipe`,
 * acessível só a `owner` (`requireOwner()` no `POST/GET /api/v1/team`,
 * mais o próprio `equipe/page.tsx` redireciona quem não for owner antes
 * de renderizar isto).
 *
 * Mesmo padrão de formulário já usado em `RestaurantSettingsForm`:
 * validação client-side com o mesmo schema Zod do Route Handler, `fetch`
 * direto, `FormField`/`toast` para erro e sucesso. Sem diálogo de
 * confirmação (diferente do slug do Perfil) — criar um funcionário não
 * invalida nada existente, não há necessidade de aviso prévio.
 *
 * Remover/desativar funcionário fica fora desta primeira versão — a Sprint
 * autorizou implementar só "se puder ser feito com segurança dentro do
 * escopo", e envolveria decidir entre excluir de vez (perde histórico de
 * quem processou o quê) ou um campo novo de "desativado" (migration nova,
 * fora do que foi pedido aqui). Fica para uma Sprint própria.
 */
export function TeamManager({ initialTeam }: TeamManagerProps) {
  const [team, setTeam] = useState<TeamMember[]>(initialTeam);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});

    const payload = { name: name.trim(), email: email.trim(), password };
    const result = createStaffSchema.safeParse(payload);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/v1/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();

      if (!response.ok) {
        const apiError = body as ApiError;
        if (apiError.error?.code === "CONFLICT") {
          setErrors({ email: apiError.error.message });
        } else {
          toast.error("Não foi possível adicionar o funcionário", apiError.error?.message);
        }
        return;
      }

      const created = body.data as TeamMember;
      setTeam((prev) => [...prev, created]);
      setName("");
      setEmail("");
      setPassword("");
      toast.success("Funcionário adicionado", created.email);
    } catch {
      toast.error("Não foi possível conectar", "Verifique sua internet e tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" aria-hidden />
            Funcionários
          </CardTitle>
          <CardDescription>Contas com acesso a Dashboard, Pedidos, Mesas e Caixa.</CardDescription>
        </CardHeader>
        <CardContent>
          {team.length === 0 ? (
            <p className="text-sm text-ds2-foreground-muted">Nenhum funcionário cadastrado ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {team.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between gap-3 rounded-ds2-md border border-ds2-border bg-ds2-surface-hover px-4 py-2.5"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-ds2-foreground">
                      {member.name || "Sem nome"}
                    </span>
                    <span className="truncate text-xs text-ds2-foreground-muted">{member.email}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" aria-hidden />
            Adicionar funcionário
          </CardTitle>
          <CardDescription>
            O funcionário poderá acessar Dashboard, Pedidos, Mesas e Caixa — não Perfil/Configurações nem edição
            do Cardápio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <FormField label="Nome" error={errors.name} required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Maria Silva"
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="E-mail" error={errors.email} required>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="funcionario@email.com"
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="Senha inicial" error={errors.password} hint="Pelo menos 6 caracteres." required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                disabled={isSubmitting}
              />
            </FormField>

            <div className="flex justify-end">
              <Button type="submit" isLoading={isSubmitting}>
                Adicionar funcionário
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
