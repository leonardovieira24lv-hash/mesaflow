import { stubResponse } from "@/lib/api/stub";

// GET /api/v1/orders/{id} — contrato seção 8.2
export async function GET() {
  return stubResponse("GET /api/v1/orders/{id}");
}
