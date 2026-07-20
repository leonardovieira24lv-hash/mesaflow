import { stubResponse } from "@/lib/api/stub";

// PATCH /api/v1/orders/{id}/status — contrato seção 8.3 (avanço e cancelamento)
export async function PATCH() {
  return stubResponse("PATCH /api/v1/orders/{id}/status");
}
