import { createClient } from "@/lib/supabase/server";
import { getOccupiedTablesCount } from "@/lib/dashboard/queries";
import { SectionError } from "@/components/dashboard/section-error";

/**
 * Sprint UI-05 (2026-07-31): responde "como está o salão" — contexto, não
 * ação (por isso vem depois de `<ActionRequired>`, nunca com cor de
 * alerta). Mesmo critério de `occupiedCount` em `tables-manager.tsx`
 * (`tables.status = 'ocupada'`), só agregado no servidor.
 */
export async function OccupiedTables({ restaurantId }: { restaurantId: string }) {
  try {
    const supabase = await createClient();
    const { occupied, total } = await getOccupiedTablesCount(supabase, restaurantId);

    return (
      <div className="flex items-center justify-between border-y border-ds2-border py-3">
        <span className="text-sm text-ds2-foreground-muted">Mesas ocupadas</span>
        <span className="font-numeric text-xl font-bold tabular-nums text-ds2-foreground">
          {occupied} / {total}
        </span>
      </div>
    );
  } catch {
    return <SectionError message="Não foi possível carregar as mesas agora." />;
  }
}
