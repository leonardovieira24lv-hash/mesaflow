import { stubResponse } from "@/lib/api/stub";

// GET /api/v1/orders — contrato seção 8.1
export async function GET() {
  return stubResponse("GET /api/v1/orders");
}
