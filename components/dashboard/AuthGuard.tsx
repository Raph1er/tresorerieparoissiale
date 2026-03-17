"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, getAuthToken, isTokenExpired } from "@/lib/client-auth";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const ready = useMemo(() => {
    if (!isMounted) {
      return false;
    }

    const token = getAuthToken();
    return Boolean(token && !isTokenExpired(token));
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    if (!ready) {
      clearSession();
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isMounted, pathname, ready, router]);

  if (!ready) {
    return <div className="guard-loading">Verification de la session...</div>;
  }

  return <>{children}</>;
}
