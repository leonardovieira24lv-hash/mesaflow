"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { ProductForm } from "@/components/cardapio/product-form";
import { ROUTES } from "@/constants/routes";
import type { ApiError } from "@/types/api";
import type { MenuCategory, MenuItem } from "@/types/domain";

interface ProductDetailProps {
  item: MenuItem;
  categories: MenuCategory[];
}

/**
 * Edição de Produto (contrato seção 6.3/6.4) + exclusão (6.5). Reaproveita
 * o mesmo `<ProductForm>` da criação — só muda o método/URL da chamada por
 * já receber `item` preenchido.
 */
export function ProductDetail({ item, categories }: ProductDetailProps) {
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/menu/items/${item.id}`, { method: "DELETE" });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiError | null;
        toast.error("Não foi possível excluir", body?.error?.message ?? "Tente novamente em instantes.");
        setIsDeleting(false);
        return;
      }

      toast.success("Produto excluído");
      router.push(ROUTES.cardapioProdutos);
    } catch {
      toast.error("Não foi possível conectar", "Verifique sua internet e tente novamente.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="max-w-xl">
        <ProductForm
          categories={categories}
          item={item}
          onSaved={() => toast.success("Produto atualizado")}
          onCancel={() => router.push(ROUTES.cardapioProdutos)}
        />
      </div>

      <div className="max-w-xl border-t border-border pt-6">
        <Button variant="destructive" onClick={() => setConfirmingDelete(true)} isLoading={isDeleting}>
          <Trash2 className="h-4 w-4" />
          Excluir produto
        </Button>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Excluir produto"
        description={`Tem certeza que deseja excluir "${item.name}"? Produtos já usados em pedidos não podem ser excluídos.`}
        variant="destructive"
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        isConfirming={isDeleting}
      />
    </div>
  );
}
