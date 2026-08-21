import { z } from "zod";

export const createManualTableItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe uma descrição.")
    .max(120, "A descrição deve ter no máximo 120 caracteres."),
  amount: z
    .number({ message: "Informe um valor válido." })
    .finite("Informe um valor válido.")
    .positive("O valor deve ser maior que zero.")
    .max(999999.99, "O valor informado é muito alto."),
  notes: z
    .string()
    .trim()
    .max(300, "A observação deve ter no máximo 300 caracteres.")
    .optional(),
});
