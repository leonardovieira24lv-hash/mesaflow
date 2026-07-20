import { stubResponse } from "@/lib/api/stub";

// GET /api/v1/public/{slug}/menu — contrato seção 3.2
export async function GET() {
  return stubResponse("GET /api/v1/public/{slug}/menu");
}
