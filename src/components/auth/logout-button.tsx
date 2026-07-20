"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ROUTES } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/** Botão de logout usado no header administrativo. */
export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    setIsLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      setIsLoading(false);
      toast.error("Não foi possível sair", "Tente novamente em instantes.");
      return;
    }

    router.refresh();
    router.push(ROUTES.login);
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Sair"
      title="Sair"
      onClick={handleLogout}
      isLoading={isLoading}
    >
      {!isLoading && <LogOut className="h-4 w-4" />}
    </Button>
  );
}
