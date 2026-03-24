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
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            {/* Cercle extérieur */}
            <div className="w-16 h-16 rounded-full border-4 border-gray-200"></div>
            {/* Cercle animé */}
            <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-gray-600 font-medium text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}