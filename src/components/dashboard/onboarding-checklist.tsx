import { CheckCircle2, Circle } from "lucide-react";
import type { Route } from "next";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantOverview } from "@/lib/restaurant/get-restaurant-overview";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button-link";
import { SectionError } from "@/components/dashboard/section-error";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  // `Route`, não `string` — `ButtonLink` estende `LinkProps` do `next/link`,
  // cujo `href` é validado por `typedRoutes` (next.config.mjs). Um campo
  // `string` aqui faria o literal de `ROUTES.*` (`as const`) perder o tipo
  // exato e quebrar o build ("Type 'string' is not assignable to '...Route...'").
  href: Route;
  cta: string;
}

/**
 * Checklist de configuração — reflete os mesmos três itens do `checklist`
 * devolvido por `GET /api/v1/restaurant` (contrato seção 4.1). Itens ainda
 * pendentes levam direto para a tela onde são resolvidos (mesmas rotas que
 * os atalhos rápidos, seção "Cardápio"/"Mesas").
 */
export async function OnboardingChecklist({ restaurantId }: { restaurantId: string }) {
  try {
    const supabase = await createClient();
    const overview = await getRestaurantOverview(supabase, restaurantId);

    const items: ChecklistItem[] = [
      {
        key: "categories",
        label: "Cadastrar categorias do cardápio",
        done: overview.checklist.hasCategories,
        href: ROUTES.cardapioCategorias,
        cta: "Cadastrar",
      },
      {
        key: "products",
        label: "Cadastrar produtos",
        done: overview.checklist.hasProducts,
        href: ROUTES.cardapioProdutos,
        cta: "Cadastrar",
      },
      {
        key: "qr",
        label: "Imprimir QR Codes das mesas",
        done: overview.checklist.qrCodesPrinted,
        href: ROUTES.mesas,
        cta: "Ver mesas",
      },
    ];

    const pendingCount = items.filter((i) => !i.done).length;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Checklist de configuração</CardTitle>
          <CardDescription>
            {pendingCount === 0
              ? "Tudo pronto — seu restaurante está totalmente configurado."
              : `${pendingCount} ${pendingCount === 1 ? "item pendente" : "itens pendentes"} para aproveitar o MesaFlow por completo.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {items.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {item.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className={cn("text-sm", item.done && "text-muted-foreground line-through")}>
                  {item.label}
                </span>
              </div>
              {!item.done && (
                <ButtonLink href={item.href} variant="outline" size="sm">
                  {item.cta}
                </ButtonLink>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  } catch {
    return <SectionError message="Não foi possível carregar o checklist agora." />;
  }
}
