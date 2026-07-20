import { stubResponse } from "@/lib/api/stub";

// POST /api/v1/public/{slug}/orders — contrato seção 3.3
export async function POST() {
  return stubResponse("POST /api/v1/public/{slug}/orders");
}
