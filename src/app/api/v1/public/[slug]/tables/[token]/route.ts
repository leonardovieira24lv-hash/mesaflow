import { stubResponse } from "@/lib/api/stub";

// GET /api/v1/public/{slug}/tables/{token} — contrato seção 3.1
export async function GET() {
  return stubResponse("GET /api/v1/public/{slug}/tables/{token}");
}
