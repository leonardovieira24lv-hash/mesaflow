import type { z, ZodTypeAny } from "zod";
import { AppError } from "@/lib/api/errors";

/**
 * Valida `input` contra um schema Zod e retorna os dados tipados.
 * Em caso de falha, lança `AppError("VALIDATION_ERROR")` já no formato de
 * `details` esperado pelo envelope de erro (contrato seção 1.3/1.7).
 *
 * Uso típico dentro de um Route Handler:
 *   const body = await request.json();
 *   const input = parseOrThrow(createCategorySchema, body);
 *
 * Correção de auditoria: a assinatura antiga (`schema: ZodSchema<T>`) fixa
 * `Input = T` (o próprio `ZodSchema<T>` é um alias para
 * `ZodType<T, ZodTypeDef, T>`), o que é incompatível com qualquer schema cujo
 * tipo de entrada difira da saída — exatamente o caso de `.default(...)`
 * (ex.: `listMenuItemsQuerySchema.page`, que aceita `number | undefined` na
 * entrada mas sempre produz `number` na saída). Isso fazia o TypeScript
 * inferir `T` de forma incorreta e devolver campos como `page`/`per_page`
 * tipados como `number | undefined` no chamador, mesmo já validados e com
 * default aplicado (`src/app/api/v1/menu/items/route.ts` não compilava).
 * Usar `ZodTypeAny` genérico e extrair `T` via `z.infer` desacopla a
 * inferência do tipo de saída do tipo de entrada do schema.
 */
export function parseOrThrow<S extends ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join(".") || "(root)",
      issue: issue.message,
    }));

    throw new AppError("VALIDATION_ERROR", "Payload inválido. Verifique os campos enviados.", details);
  }

  return result.data;
}
