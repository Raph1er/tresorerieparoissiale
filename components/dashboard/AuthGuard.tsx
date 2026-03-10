"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, getAuthToken, isTokenExpired } from "@/lib/client-auth";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const token = getAuthToken();
  const ready = Boolean(token && !isTokenExpired(token));

  useEffect(() => {
    if (!ready) {
      clearSession();
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, ready, router]);

  if (!ready) {
    return <div className="guard-loading">Verification de la session...</div>;
  }

  return <>{children}</>;
}
