import type { LucideIcon } from "lucide-react";
import { LayoutGrid, UtensilsCrossed, Package, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantOverview } from "@/lib/restaurant/get-restaurant-overview";
import { getOrdersTodayCount } from "@/lib/dashboard/queries";
import { Card, CardContent } from "@/components/ui/card";
import { SectionError } from "@/components/dashboard/section-error";

interface SummaryItem {
  label: string;
  value: number;
  icon: LucideIcon;
}

/**
 * Cards de indicadores rápidos. Todos os números são dado real (contagens
 * diretas do banco) — nunca um placeholder fixo. Enquanto Cardápio e
 * Pedidos não existirem de verdade, Categorias/Produtos/Pedidos hoje
 * legitimamente mostram 0; o card já está pronto para os números reais
 * assim que esses módulos entrarem em produção, sem qualquer mudança aqui.
 */
export async function SummaryCards({ restaurantId }: { restaurantId: string }) {
  try {
    const supabase = await createClient();
    const [overview, ordersToday] = await Promise.all([
      getRestaurantOverview(supabase, restaurantId),
      getOrdersTodayCount(supabase, restaurantId),
    ]);

    const items: SummaryItem[] = [
      { label: "Mesas", value: overview.counts.tables, icon: LayoutGrid },
      { label: "Categorias", value: overview.counts.categories, icon: UtensilsCrossed },
      { label: "Produtos", value: overview.counts.products, icon: Package },
      { label: "Pedidos hoje", value: ordersToday, icon: ClipboardList },
    ];

    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {items.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-start justify-between p-5">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="font-mono text-2xl font-semibold">{value}</span>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                <Icon className="h-4 w-4 text-primary" aria-hidden />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  } catch {
    return <SectionError message="Não foi possível carregar os indicadores agora." />;
  }
}
