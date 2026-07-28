import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";

// POST /api/v1/tables/qr-codes/print-confirmation — contrato seção 7.5
//
// Conclui o item "QR Codes impressos" do checklist de onboarding. Atualiza
// `qr_codes_printed_at` e, **apenas se este for o último item pendente do
// checklist** (contrato seção 7.5: "se este for o último item pendente"),
// transiciona `restaurants.status` de `'onboarding'` para `'active'` na
// mesma escrita.
//
// Correção de auditoria (antes da Sprint 7): esta rota transicionava para
// `'active'` incondicionalmente, tratando a impressão de QR Codes como único
// item do checklist — regra correta apenas até a Sprint 4, quando
// categorias/produtos (seção 4.1) ainda não existiam. Desde a Sprint 6
// (Cardápio), o checklist tem três itens reais (`has_categories`,
// `has_products`, `qr_codes_printed`), então a transição agora exige os três.
// Isso já estava sinalizado no comentário original ("revisar quando o módulo
// de Cardápio for implementado") e não havia sido feito.
export async function POST() {
  try {
    const { profile } = await requireSession();
    const supabase = await createClient();

    const [restaurantResult, categoriesResult, productsResult] = await Promise.all([
      supabase.from("restaurants").select("status").eq("id", profile.restaurantId).single(),
      supabase
        .from("menu_categories")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", profile.restaurantId),
      supabase
        .from("menu_items")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", profile.restaurantId),
    ]);

    if (restaurantResult.error || !restaurantResult.data) {
      throw new AppError("NOT_FOUND", "Restaurante não encontrado.");
    }

    const current = restaurantResult.data;
    const hasCategories = (categoriesResult.count ?? 0) > 0;
    const hasProducts = (productsResult.count ?? 0) > 0;
    const checklistComplete = hasCategories && hasProducts;

    const nextStatus = current.status === "onboarding" && checklistComplete ? "active" : current.status;
    const printedAt = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("restaurants")
      .update({ qr_codes_printed_at: printedAt, status: nextStatus })
      .eq("id", profile.restaurantId)
      .select("qr_codes_printed_at")
      .single();

    if (updateError || !updated) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível confirmar a impressão dos QR Codes.");
    }

    return apiSuccess({ qr_codes_printed_at: updated.qr_codes_printed_at });
  } catch (err) {
    return handleRouteError(err);
  }
}
