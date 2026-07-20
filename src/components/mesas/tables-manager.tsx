"use client";

import { useState, type FormEvent } from "react";
import { LayoutGrid, Pencil, Plus, QrCode, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableStatusBadge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { TableQrModal } from "@/components/mesas/table-qr-modal";
import { createTableSchema, updateTableSchema, TABLE_STATUS_VALUES } from "@/lib/validations/tables";
import type { Table as TableEntity, TableStatus } from "@/types/domain";
import type { ApiError } from "@/types/api";

interface TablesManagerProps {
  initialTables: TableEntity[];
  /** Slug do restaurante, para montar a URL codificada no QR Code (`/{slug}/mesa/{qr_token}`). */
  restaurantSlug: string;
}

interface TableDto {
  id: string;
  name: string;
  status: TableStatus;
  qr_token: string;
}

function fromDto(dto: TableDto): TableEntity {
  return { id: dto.id, name: dto.name, status: dto.status, qrToken: dto.qr_token };
}

const STATUS_LABELS: Record<TableStatus, string> = {
  livre: "Livre",
  ocupada: "Ocupada",
  manutencao: "Manutenção",
};

/**
 * Lista + CRUD de Mesas (contrato seção 7). Mesmo padrão de
 * `components/cardapio/categories-manager.tsx`: Server Component (página)
 * carrega a lista inicial, este componente cuida de toda a interação via
 * `/api/v1/tables`.
 */
export function TablesManager({ initialTables, restaurantSlug }: TablesManagerProps) {
  const [tables, setTables] = useState<TableEntity[]>(initialTables);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableEntity | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<TableStatus>("livre");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deletingTable, setDeletingTable] = useState<TableEntity | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const [qrTable, setQrTable] = useState<TableEntity | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  function tableUrl(table: TableEntity) {
    return `${origin}/${restaurantSlug}/mesa/${table.qrToken}`;
  }

  function openCreateModal() {
    setEditingTable(null);
    setName("");
    setStatus("livre");
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(table: TableEntity) {
    setEditingTable(table);
    setName(table.name);
    setStatus(table.status);
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const isEditing = Boolean(editingTable);

    if (isEditing) {
      const result = updateTableSchema.safeParse({ name, status });
      if (!result.success) {
        setFormError(result.error.issues[0]?.message ?? "Dados inválidos.");
        return;
      }

      setIsSubmitting(true);
      try {
        const response = await fetch(`/api/v1/tables/${editingTable!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const body = await response.json();

        if (!response.ok) {
          const apiError = body as ApiError;
          setFormError(apiError.error?.message ?? "Não foi possível salvar a mesa.");
          setIsSubmitting(false);
          return;
        }

        const saved = fromDto(body.data as TableDto);
        setTables((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
        toast.success("Mesa atualizada");
        setModalOpen(false);
        setIsSubmitting(false);
      } catch {
        setFormError("Não foi possível conectar. Verifique sua internet e tente novamente.");
        setIsSubmitting(false);
      }
      return;
    }

    // Criação: nome em branco é válido (contrato 7.2 — gera automaticamente).
    const result = createTableSchema.safeParse({ name: name.trim() ? name : undefined });
    if (!result.success) {
      setFormError(result.error.issues[0]?.message ?? "Nome inválido.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/v1/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      const body = await response.json();

      if (!response.ok) {
        const apiError = body as ApiError;
        setFormError(apiError.error?.message ?? "Não foi possível criar a mesa.");
        setIsSubmitting(false);
        return;
      }

      const saved = fromDto(body.data as TableDto);
      setTables((prev) => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success("Mesa criada");
      setModalOpen(false);
      setIsSubmitting(false);
    } catch {
      setFormError("Não foi possível conectar. Verifique sua internet e tente novamente.");
      setIsSubmitting(false);
    }
  }

  async function handleQuickStatusChange(table: TableEntity, nextStatus: TableStatus) {
    if (nextStatus === table.status) return;
    setStatusUpdatingId(table.id);

    try {
      const response = await fetch(`/api/v1/tables/${table.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = await response.json();

      if (!response.ok) {
        const apiError = body as ApiError;
        toast.error("Não foi possível atualizar o status", apiError.error?.message);
        setStatusUpdatingId(null);
        return;
      }

      const saved = fromDto(body.data as TableDto);
      setTables((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
      setStatusUpdatingId(null);
    } catch {
      toast.error("Não foi possível conectar", "Verifique sua internet e tente novamente.");
      setStatusUpdatingId(null);
    }
  }

  async function handleDelete() {
    if (!deletingTable) return;
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/v1/tables/${deletingTable.id}`, { method: "DELETE" });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiError | null;
        toast.error("Não foi possível excluir", body?.error?.message ?? "Tente novamente em instantes.");
        setIsDeleting(false);
        return;
      }

      setTables((prev) => prev.filter((t) => t.id !== deletingTable.id));
      toast.success("Mesa excluída");
      setDeletingTable(null);
      setIsDeleting(false);
    } catch {
      toast.error("Não foi possível conectar", "Verifique sua internet e tente novamente.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          Nova mesa
        </Button>
      </div>

      {tables.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="Nenhuma mesa cadastrada"
          description="Adicione a primeira mesa para gerar seu QR Code de acesso ao cardápio."
          action={
            <Button onClick={openCreateModal} variant="outline">
              <Plus className="h-4 w-4" />
              Nova mesa
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mesa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tables.map((table) => (
              <TableRow key={table.id}>
                <TableCell className="font-mono font-medium">{table.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <TableStatusBadge status={table.status} />
                    <Select
                      aria-label={`Alterar status de ${table.name}`}
                      value={table.status}
                      disabled={statusUpdatingId === table.id}
                      onChange={(e) =>
                        handleQuickStatusChange(table, e.target.value as TableStatus)
                      }
                      className="h-8 w-36 text-xs"
                    >
                      {TABLE_STATUS_VALUES.map((value) => (
                        <option key={value} value={value}>
                          {STATUS_LABELS[value]}
                        </option>
                      ))}
                    </Select>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setQrTable(table)}
                      aria-label={`Ver QR Code de ${table.name}`}
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditModal(table)}
                      aria-label={`Editar ${table.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingTable(table)}
                      aria-label={`Excluir ${table.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTable ? "Editar mesa" : "Nova mesa"}
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 pb-6">
          <FormField
            label="Nome da mesa"
            error={formError ?? undefined}
            hint={editingTable ? undefined : "Deixe em branco para gerar o próximo número automaticamente."}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Mesa 01, Varanda 2"
              disabled={isSubmitting}
              autoFocus
            />
          </FormField>

          {editingTable && (
            <FormField label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value as TableStatus)}>
                {TABLE_STATUS_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingTable ? "Salvar" : "Criar mesa"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingTable)}
        onOpenChange={(open) => !open && setDeletingTable(null)}
        title="Excluir mesa"
        description={`Tem certeza que deseja excluir "${deletingTable?.name}"? Mesas com uma comanda em aberto não podem ser excluídas.`}
        variant="destructive"
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        isConfirming={isDeleting}
      />

      {qrTable && (
        <TableQrModal
          open={Boolean(qrTable)}
          onClose={() => setQrTable(null)}
          tableName={qrTable.name}
          url={tableUrl(qrTable)}
        />
      )}
    </div>
  );
}
