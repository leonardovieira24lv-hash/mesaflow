import { stubResponse } from "@/lib/api/stub";

// GET /api/v1/public/{slug}/orders/{order_id} — contrato seção 3.4
export async function GET() {
  return stubResponse("GET /api/v1/public/{slug}/orders/{orderId}");
}
