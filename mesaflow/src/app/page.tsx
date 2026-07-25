import { redirect } from "next/navigation";

/**
 * A raiz do domínio não tem UI própria: o admin entra por `/login`, e o
 * cliente final sempre chega por um link com slug (`/{slug}/mesa/{token}`)
 * escaneado no QR Code — nunca por `/`.
 */
export default function RootPage() {
  redirect("/login");
}
