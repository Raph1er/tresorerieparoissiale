"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AuthUser } from "@/lib/client-auth";

const PermissionContext = createContext<AuthUser | null>(null);

export function PermissionProvider({
  user,
  children,
}: {
  user: AuthUser;
  children: ReactNode;
}) {
  return (
    <PermissionContext.Provider value={user}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissionContext(): AuthUser | null {
  return useContext(PermissionContext);
}
