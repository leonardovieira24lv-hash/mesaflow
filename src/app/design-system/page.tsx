"use client";

import { useState } from "react";
import { Trash2, Inbox, Plus, Mail, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge, OrderStatusBadge, TableStatusBadge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardDivider } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { Skeleton, SkeletonText, SkeletonAvatar, SkeletonCard } from "@/components/ui/skeleton";
import { Spinner, PageLoading } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { FormField } from "@/components/ui/form-field";

export default function DesignSystemPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [page, setPage] = useState(4);
  const [showLoading, setShowLoading] = useState(false);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-16 p-6 py-12 md:p-12">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">Design System · v2</p>
        <h1 className="font-display text-4xl font-bold tracking-tight">MesaFlow</h1>
        <p className="max-w-2xl text-muted-foreground">
          Biblioteca de componentes oficial. Paleta neutra grafite/branco com indigo como cor de ação,
          Manrope para títulos, Inter para interface e monoespaçado para todo dado — mesa, pedido, preço.
          Nenhuma regra de negócio vive aqui, só identidade visual e componentes reutilizáveis.
        </p>
      </header>

      {/* Cores */}
      <Section title="Cores" description="Tokens semânticos — nunca usar hex solto nos componentes.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
          <Swatch name="Background" className="bg-background border border-border" />
          <Swatch name="Surface" className="bg-surface border border-border" />
          <Swatch name="Primary (Indigo)" className="bg-primary text-primary-foreground" />
          <Swatch name="Success" className="bg-success text-success-foreground" />
          <Swatch name="Warning" className="bg-warning text-warning-foreground" />
          <Swatch name="Destructive" className="bg-destructive text-destructive-foreground" />
          <Swatch name="Info" className="bg-info text-info-foreground" />
          <Swatch name="Muted" className="bg-muted" />
        </div>
      </Section>

      {/* Tipografia */}
      <Section title="Tipografia" description="Display (Manrope) · Sans (Inter) · Mono (IBM Plex Mono).">
        <div className="flex flex-col gap-4">
          <p className="font-display text-3xl font-semibold">Cardápio do dia — Manrope 800</p>
          <p className="text-base text-foreground">
            Texto de interface e corpo em Inter. Usado em rótulos, parágrafos e a maior parte da UI.
          </p>
          <p className="font-mono text-sm text-muted-foreground">
            Mesa 07 · Pedido #A93F2 · R$ 49,80 · 14:32 — IBM Plex Mono, reservada para dado.
          </p>
        </div>
      </Section>

      {/* Espaçamento */}
      <Section title="Espaçamento" description="Escala base 4px (Tailwind), documentada para consistência.">
        <div className="flex flex-wrap items-end gap-3">
          {[1, 2, 3, 4, 6, 8, 12, 16].map((n) => (
            <div key={n} className="flex flex-col items-center gap-1">
              <div className="bg-primary" style={{ width: n * 4, height: n * 4 }} />
              <span className="font-mono text-xs text-muted-foreground">{n * 4}px</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Botões */}
      <Section title="Botões">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Salvar alterações</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="outline">Contorno</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">
            <Trash2 className="h-4 w-4" /> Excluir
          </Button>
          <Button variant="link">Link</Button>
          <Button isLoading>Enviando</Button>
          <Button variant="outline" size="icon" aria-label="Buscar">
            <Search className="h-4 w-4" />
          </Button>
          <Button disabled>Desabilitado</Button>
        </div>
      </Section>

      {/* Formulário */}
      <Section title="Componentes de formulário">
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField label="Nome da categoria" hint="Visível para o cliente no cardápio." required>
            <Input placeholder="Ex.: Lanches" />
          </FormField>
          <FormField label="E-mail" error="Este e-mail já está cadastrado.">
            <Input type="email" leadingIcon={<Mail />} placeholder="voce@restaurante.com" />
          </FormField>
          <FormField label="Categoria">
            <Select defaultValue="">
              <option value="" disabled>
                Selecione...
              </option>
              <option>Lanches</option>
              <option>Bebidas</option>
              <option>Sobremesas</option>
            </Select>
          </FormField>
          <FormField label="Observações do pedido" hint="Opcional.">
            <Textarea placeholder="Ex.: sem cebola" />
          </FormField>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <label className="flex items-center gap-3 text-sm">
            <Checkbox defaultChecked /> Aceito os termos de uso
          </label>
          <label className="flex items-center gap-3 text-sm">
            <Switch defaultChecked /> Produto disponível no cardápio
          </label>
        </div>
      </Section>

      {/* Badges */}
      <Section title="Badges" description="Status de pedido e mesa já mapeados para cor certa.">
        <div className="flex flex-wrap gap-2">
          <OrderStatusBadge status="pending" />
          <OrderStatusBadge status="preparing" />
          <OrderStatusBadge status="ready" />
          <OrderStatusBadge status="delivered" />
          <OrderStatusBadge status="cancelled" />
          <TableStatusBadge status="livre" />
          <TableStatusBadge status="ocupada" />
          <TableStatusBadge status="manutencao" />
          <Badge variant="info">Novo</Badge>
        </div>
      </Section>

      {/* Cards */}
      <Section title="Cards" description="CardDivider separa seções dentro de um mesmo card (ex.: itens do total).">
        <div className="grid gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Categorias cadastradas</CardTitle>
              <CardDescription>4 categorias ativas no cardápio.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Conteúdo genérico de card administrativo.</p>
            </CardContent>
            <CardFooter>
              <Button size="sm" variant="outline">
                Ver todas
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Pedido #A93F2 <OrderStatusBadge status="preparing" />
              </CardTitle>
              <CardDescription className="font-mono">Mesa 07 · 14:32</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span>2× X-Burger</span>
                <span className="font-mono">R$ 49,80</span>
              </div>
              <div className="flex justify-between">
                <span>1× Coca-Cola</span>
                <span className="font-mono">R$ 8,00</span>
              </div>
            </CardContent>
            <CardDivider />
            <CardFooter className="justify-between">
              <span className="font-medium">Total</span>
              <span className="font-mono font-semibold">R$ 57,80</span>
            </CardFooter>
          </Card>
        </div>
      </Section>

      {/* Tabela */}
      <Section title="Tabelas">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">X-Burger</TableCell>
              <TableCell>Lanches</TableCell>
              <TableCell className="font-mono">R$ 24,90</TableCell>
              <TableCell>
                <Badge variant="success">Disponível</Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Coca-Cola 350ml</TableCell>
              <TableCell>Bebidas</TableCell>
              <TableCell className="font-mono">R$ 8,00</TableCell>
              <TableCell>
                <Badge variant="muted">Indisponível</Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Pagination page={page} totalPages={12} onPageChange={setPage} className="mt-4" />
      </Section>

      {/* Modais e Toasts */}
      <Section title="Modais, confirmação e notificações">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setModalOpen(true)}>
            Abrir modal
          </Button>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            Excluir categoria
          </Button>
          <Button variant="outline" onClick={() => toast.success("Categoria criada", "Lanches já aparece no cardápio.")}>
            Toast de sucesso
          </Button>
          <Button variant="outline" onClick={() => toast.error("Não foi possível excluir", "Existem produtos vinculados a esta categoria.")}>
            Toast de erro
          </Button>
        </div>

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Nova categoria"
          description="Ela aparecerá no fim da lista do cardápio."
          footer={
            <>
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => setModalOpen(false)}>Criar categoria</Button>
            </>
          }
        >
          <FormField label="Nome" required>
            <Input placeholder="Ex.: Sobremesas" />
          </FormField>
        </Modal>

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Excluir categoria?"
          description="Categorias com produtos vinculados não podem ser excluídas."
          confirmLabel="Excluir"
          variant="destructive"
          onConfirm={() => setConfirmOpen(false)}
        />
      </Section>

      {/* Skeletons e Loading */}
      <Section title="Skeletons e loading">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <SkeletonAvatar />
              <div className="flex flex-1 flex-col gap-2">
                <SkeletonText width="50%" />
                <SkeletonText width="80%" />
              </div>
            </div>
            <Skeleton className="h-24 w-full" />
          </div>
          <SkeletonCard />
        </div>
        <div className="mt-6 flex items-center gap-6">
          <Spinner />
          <Button variant="outline" onClick={() => setShowLoading((v) => !v)}>
            {showLoading ? "Esconder" : "Mostrar"} PageLoading
          </Button>
        </div>
        {showLoading && <PageLoading label="Carregando pedidos" />}
      </Section>

      {/* Empty state */}
      <Section title="Empty states">
        <EmptyState
          icon={Inbox}
          title="Nenhum pedido ainda"
          description="Assim que um cliente fizer um pedido pela mesa, ele aparece aqui em tempo real."
          action={
            <Button size="sm">
              <Plus className="h-4 w-4" /> Ver mesas
            </Button>
          }
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`flex h-16 items-end rounded-md p-2 text-xs font-medium ${className}`}>{name}</div>
    </div>
  );
}
