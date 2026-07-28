import { requirePageSession } from "@/lib/auth/require-page-session";

export const dynamic = "force-dynamic";

export default async function DebugRestaurantPage() {
  await requirePageSession();
  return (
    <div>
      <h1>Debug Tools — Restaurant</h1>
      <p>
        Ainda não implementada. Planejado: dados do restaurante e do profile autenticado, e contagem de profiles
        duplicados para o mesmo e-mail (útil após reconfigurações de ambiente).
      </p>
    </div>
  );
}
