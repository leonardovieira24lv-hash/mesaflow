"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface AdminShellContextValue {
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
}

const AdminShellContext = createContext<AdminShellContextValue | null>(null);

/** Estado compartilhado entre Sidebar e Header — hoje só controla o drawer mobile. */
export function AdminShellProvider({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  return (
    <AdminShellContext.Provider value={{ mobileNavOpen, setMobileNavOpen }}>
      {children}
    </AdminShellContext.Provider>
  );
}

export function useAdminShell() {
  const ctx = useContext(AdminShellContext);
  if (!ctx) throw new Error("useAdminShell deve ser usado dentro de <AdminShellProvider>");
  return ctx;
}
