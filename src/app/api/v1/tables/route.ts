import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/api/auth";
import { apiSuccess, apiCreated } from "@/lib/api/response";
import { AppError, handleRouteError } from "@/lib/api/errors";
import { parseOrThrow } from "@/lib/api/validation";
import { createTableSchema } from "@/lib/validations/tables";

// Quantas tentativas de nome automático antes de desistir (contrato 7.2:
// "se omitido, gera automaticamente o próximo número sequencial"). Mesmo
// espírito de `nextSlugCandidate` (lib/slug.ts): tenta o próximo candidato
// em caso de conflito de unicidade, em vez de falhar na primeira colisão.
const MAX_AUTO_NAME_ATTEMPTS = 50;

// GET /api/v1/tables — contrato seção 7.1
export async function GET() {
  try {
    const { profile } = await requireSession();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("tables")
      .select("id, name, status, qr_token")
      .eq("restaurant_id", profile.restaurantId)
      .order("name", { ascending: true });

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível carregar as mesas.");
    }

    return apiSuccess(
      data.map((t) => ({ id: t.id, name: t.name, status: t.status, qr_token: t.qr_token })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST /api/v1/tables — contrato seção 7.2
export async function POST(request: Request) {
  try {
    const { profile } = await requireSession();

    // Corpo é opcional por completo (contrato 7.2: `{ "name": "string
    // (opcional)" }`) — um POST sem corpo, ou com `{}`, é o caso normal de
    // "adicionar mesa" sem nome manual.
    const rawBody = await request.text();
    const body = rawBody ? JSON.parse(rawBody) : {};
    const { name } = parseOrThrow(createTableSchema, body);

    const supabase = await createClient();

    if (name) {
      const { data: created, error } = await supabase
        .from("tables")
        .insert({ restaurant_id: profile.restaurantId, name })
        .select("id, name, status, qr_token")
        .single();

      if (error) {
        // 23505 = unique_violation (restaurant_id, name) — nome duplicado
        // informado manualmente (contrato 7.2: "nome único dentro do
        // restaurante, se informado manualmente").
        if (error.code === "23505") {
          throw new AppError("CONFLICT", "Já existe uma mesa com esse nome.");
        }
        throw new AppError("INTERNAL_ERROR", "Não foi possível criar a mesa. Tente novamente.");
      }

      return apiCreated({
        id: created.id,
        name: created.name,
        status: created.status,
        qr_token: created.qr_token,
      });
    }

    // Nome não informado: gera o próximo número sequencial a partir da
    // quantidade atual de mesas do restaurante, com o mesmo padrão de
    // preenchimento com zero usado na criação em lote do onboarding
    // (`api/v1/onboarding/tables/route.ts`: "Mesa 01", "Mesa 02", ...).
    // Retenta com o próximo número em caso de conflito — nomes podem ter
    // sido alterados manualmente (7.3), então a contagem bruta nem sempre
    // aponta para um número livre de primeira.
    const { count, error: countError } = await supabase
      .from("tables")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", profile.restaurantId);

    if (countError) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível calcular o número da mesa.");
    }

    const startingNumber = (count ?? 0) + 1;
    const padLength = Math.max(2, String(startingNumber + MAX_AUTO_NAME_ATTEMPTS).length);

    for (let attempt = 0; attempt < MAX_AUTO_NAME_ATTEMPTS; attempt++) {
      const candidateName = `Mesa ${String(startingNumber + attempt).padStart(padLength, "0")}`;

      const { data: created, error } = await supabase
        .from("tables")
        .insert({ restaurant_id: profile.restaurantId, name: candidateName })
        .select("id, name, status, qr_token")
        .single();

      if (!error) {
        return apiCreated({
          id: created.id,
          name: created.name,
          status: created.status,
          qr_token: created.qr_token,
        });
      }

      if (error.code !== "23505") {
        throw new AppError("INTERNAL_ERROR", "Não foi possível criar a mesa. Tente novamente.");
      }
      // 23505: já existe mesa com esse nome gerado — tenta o próximo número.
    }

    throw new AppError(
      "INTERNAL_ERROR",
      "Não foi possível gerar um nome automático para a mesa. Informe um nome manualmente.",
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
