import { Bell, Check, ChevronRight, Plus, Search, Trash2 } from "lucide-react";

export const metadata = { title: "Design System 2.0" };

/**
 * MesaFlow Design System 2.0 — Sprint 1 (fundação), 2026-07-30.
 *
 * Esta página é a ÚNICA coisa que esta sprint desenha de verdade — nenhuma
 * tela do produto (Dashboard, Login, Cardápio, Mesas, Caixa) foi tocada.
 * Os tokens abaixo vivem em `.ds2-dark` (`app/globals.css`), uma classe
 * nova que não é aplicada em nenhum outro lugar do app ainda — sprints
 * futuras vão adotá-la tela por tela.
 *
 * Os "componentes" aqui embaixo são pré-visualizações estáticas (não os
 * componentes reais de `components/ui/`) — de propósito: os componentes
 * reais continuam servindo as telas em produção com os tokens atuais
 * (`--primary`, `--surface`...); portá-los para os tokens `ds2-*` é
 * trabalho de sprint futura, quando as telas também migrarem, para nunca
 * mudar a aparência de algo em produção como efeito colateral de uma
 * sprint "só fundação".
 */
export default function DesignSystemV2Page() {
  return (
    <div className="ds2-dark min-h-screen">
      <div className="mx-auto flex max-w-5xl flex-col gap-16 p-6 py-12 md:p-12">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-xs uppercase tracking-widest text-ds2-primary">Design System · 2.0 · Sprint 1</p>
          <h1 className="font-display text-4xl font-bold tracking-tight text-ds2-foreground">Forko</h1>
          <p className="max-w-2xl text-ds2-foreground-muted">
            Fundação do novo sistema visual: grafite quase preto, verde como única cor de marca, sem dourado.
            Esta sprint só cria e documenta os tokens — nenhuma tela existente foi redesenhada.
          </p>
        </header>

        <Section title="Cores" description="Fundo/superfície com 3 degraus de profundidade; verde é a única cor cromática de marca.">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            <Swatch name="Background" className="border border-ds2-border bg-ds2-background text-ds2-foreground" />
            <Swatch name="Surface" className="border border-ds2-border bg-ds2-surface text-ds2-foreground" />
            <Swatch name="Surface hover" className="border border-ds2-border bg-ds2-surface-hover text-ds2-foreground" />
            <Swatch name="Primary" className="bg-ds2-primary text-ds2-primary-foreground" />
            <Swatch name="Success" className="bg-ds2-success text-ds2-success-foreground" />
            <Swatch name="Warning" className="bg-ds2-warning text-ds2-warning-foreground" />
            <Swatch name="Danger" className="bg-ds2-danger text-ds2-danger-foreground" />
            <Swatch name="Info" className="bg-ds2-info text-ds2-info-foreground" />
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <span className="text-ds2-foreground">Texto principal</span>
            <span className="text-ds2-foreground-muted">Texto secundário</span>
            <span className="text-ds2-foreground-subtle">Texto discreto</span>
          </div>
        </Section>

        <Section title="Tipografia" description="Mesmas famílias já em uso (Poppins/Inter) — hierarquia formalizada em 6 níveis fixos.">
          <div className="flex flex-col gap-3">
            <p className="font-display text-3xl font-bold text-ds2-foreground">Título principal — 30px/Bold</p>
            <p className="font-display text-xl font-semibold text-ds2-foreground">Título secundário — 20px/Semibold</p>
            <p className="text-base text-ds2-foreground">Texto — 16px/Regular, corpo e interface em geral.</p>
            <p className="text-sm text-ds2-foreground-muted">Legenda — 14px/Regular, metadado e apoio.</p>
            <p className="text-xs font-medium uppercase tracking-wide text-ds2-foreground-muted">Label — 12px/Medium, maiúsculas</p>
            <p className="text-sm font-semibold text-ds2-foreground">Botão — 14px/Semibold</p>
          </div>
        </Section>

        <Section title="Espaçamento, raio e borda" description="Escala base 4px (Tailwind) + 3 raios nomeados.">
          <div className="flex flex-wrap items-end gap-4">
            {[1, 2, 3, 4, 6, 8, 12].map((n) => (
              <div key={n} className="flex flex-col items-center gap-1">
                <div className="bg-ds2-primary" style={{ width: n * 4, height: n * 4 }} />
                <span className="font-mono text-xs text-ds2-foreground-subtle">{n * 4}px</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-end gap-4">
            {[
              { name: "sm", cls: "rounded-ds2-sm" },
              { name: "md", cls: "rounded-ds2-md" },
              { name: "lg", cls: "rounded-ds2-lg" },
              { name: "full", cls: "rounded-ds2-full" },
            ].map((r) => (
              <div key={r.name} className="flex flex-col items-center gap-1">
                <div className={`h-14 w-14 border border-ds2-border-strong bg-ds2-surface ${r.cls}`} />
                <span className="font-mono text-xs text-ds2-foreground-subtle">{r.name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Sombra e transição" description="3 níveis de sombra (com realce de 1px pra dar espessura) + 3 durações, uma curva só.">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { name: "sm", cls: "shadow-ds2-sm" },
              { name: "md", cls: "shadow-ds2-md" },
              { name: "lg", cls: "shadow-ds2-lg" },
            ].map((s) => (
              <div
                key={s.name}
                className={`flex h-20 items-center justify-center rounded-ds2-md border border-ds2-border bg-ds2-surface font-mono text-xs text-ds2-foreground-muted ${s.cls}`}
              >
                shadow-{s.name}
              </div>
            ))}
          </div>
          <p className="mt-4 font-mono text-xs text-ds2-foreground-subtle">
            duration-ds2-fast (120ms) · duration-ds2-base (180ms) · duration-ds2-slow (280ms) · ease-ds2
          </p>
        </Section>

        <Section title="Ícones" description="lucide-react, 16px em controles densos (botão pequeno, input) e 20px no restante — sempre strokeWidth 2, nunca misturado com 1.5/2.5 na mesma tela.">
          <div className="flex flex-wrap items-center gap-6 text-ds2-foreground-muted">
            <IconSample icon={Search} label="16px" size="h-4 w-4" />
            <IconSample icon={Bell} label="20px" size="h-5 w-5" />
            <IconSample icon={Plus} label="24px" size="h-6 w-6" />
          </div>
        </Section>

        <Section title="Botões" description="Preenchido (ação principal), contorno, texto — hover/focus/disabled com os tokens de estado.">
          <div className="flex flex-wrap items-center gap-3">
            <Ds2Button variant="primary">Salvar alterações</Ds2Button>
            <Ds2Button variant="outline">Contorno</Ds2Button>
            <Ds2Button variant="ghost">Texto</Ds2Button>
            <Ds2Button variant="danger">
              <Trash2 className="h-4 w-4" /> Excluir
            </Ds2Button>
            <Ds2Button variant="primary" disabled>
              Desabilitado
            </Ds2Button>
          </div>
        </Section>

        <Section title="Badge, card e input" description="Pré-visualização estática — cores/raio/sombra vêm só dos tokens acima.">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-ds2-full bg-ds2-success/15 px-2.5 py-1 text-xs font-medium text-ds2-success">
              <Check className="h-3 w-3" /> Finalizada
            </span>
            <span className="inline-flex items-center rounded-ds2-full bg-ds2-warning/15 px-2.5 py-1 text-xs font-medium text-ds2-warning">
              Em preparo
            </span>
            <span className="inline-flex items-center rounded-ds2-full bg-ds2-danger/15 px-2.5 py-1 text-xs font-medium text-ds2-danger">
              Cancelado
            </span>
            <span className="inline-flex items-center rounded-ds2-full bg-ds2-info/15 px-2.5 py-1 text-xs font-medium text-ds2-info">
              Info
            </span>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-ds2-lg border border-ds2-border bg-ds2-surface p-5 shadow-ds2-sm">
              <div className="flex items-center justify-between">
                <span className="font-display text-base font-semibold text-ds2-foreground">Mesa 07</span>
                <ChevronRight className="h-4 w-4 text-ds2-foreground-subtle" />
              </div>
              <p className="text-sm text-ds2-foreground-muted">2× X-Burger, 1× Coca-Cola</p>
              <div className="border-t border-ds2-border pt-3 text-right font-numeric text-lg font-bold text-ds2-foreground">
                R$ 57,80
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-ds2-foreground-muted">Nome da categoria</span>
              <input
                placeholder="Ex.: Lanches"
                className="rounded-ds2-md border border-ds2-border bg-ds2-surface px-3.5 py-2.5 text-sm text-ds2-foreground placeholder:text-ds2-foreground-subtle transition-colors duration-ds2-base ease-ds2 focus:border-ds2-primary focus:outline-none focus:ring-2 focus:ring-ds2-ring/40"
              />
            </label>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-ds2-foreground">{title}</h2>
        {description && <p className="text-sm text-ds2-foreground-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className={`flex h-16 items-end rounded-ds2-md p-2 text-xs font-medium ${className}`}>{name}</div>
  );
}

function IconSample({ icon: Icon, label, size }: { icon: typeof Search; label: string; size: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Icon className={size} strokeWidth={2} aria-hidden />
      <span className="font-mono text-xs text-ds2-foreground-subtle">{label}</span>
    </div>
  );
}

function Ds2Button({
  variant,
  disabled,
  children,
}: {
  variant: "primary" | "outline" | "ghost" | "danger";
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const base =
    "inline-flex items-center gap-2 rounded-ds2-md px-4 py-2.5 text-sm font-semibold transition-all duration-ds2-base ease-ds2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds2-ring/50 disabled:cursor-not-allowed disabled:opacity-40";
  const variants: Record<string, string> = {
    primary: "bg-ds2-primary text-ds2-primary-foreground hover:bg-ds2-primary-hover active:bg-ds2-primary-active",
    outline: "border border-ds2-border-strong text-ds2-foreground hover:bg-ds2-surface-hover",
    ghost: "text-ds2-foreground-muted hover:bg-ds2-surface-hover hover:text-ds2-foreground",
    danger: "bg-ds2-danger text-ds2-danger-foreground hover:brightness-110",
  };
  return (
    <button type="button" disabled={disabled} className={`${base} ${variants[variant]}`}>
      {children}
    </button>
  );
}
