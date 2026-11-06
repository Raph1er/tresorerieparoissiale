"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, getAuthToken, isTokenExpired, setAuthUser, type AuthUser } from "@/lib/client-auth";
import { MODULE_PERMISSIONS } from "@/lib/module-permissions";
import { PermissionProvider } from "./PermissionContext";

type GuardState =
  | { status: "checking" }
  | { status: "ready"; user: AuthUser }
  | { status: "error"; message: string };

function PageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-gray-200" />
          <div className="absolute left-0 top-0 h-16 w-16 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
        <p className="text-sm font-medium text-gray-600">Patientez...</p>
      </div>
    </div>
  );
}

export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [guard, setGuard] = useState<GuardState>({ status: "checking" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    async function verifyAccess() {
      setGuard({ status: "checking" });
      const token = getAuthToken();
      if (!token || isTokenExpired(token)) {
        clearSession();
        if (active) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        }
        return;
      }

      try {
        const response = await fetch("/api/auth/session", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok) {
          if (!active) {
            return;
          }
          if (response.status === 401 || data?.code === "ACCOUNT_DISABLED") {
            clearSession();
          }
          if (response.status === 401) {
            router.replace("/login?expired=1");
          } else if (response.status === 403) {
            router.replace("/403");
          } else {
            setGuard({
              status: "error",
              message: data?.erreur ?? "Vérification temporairement indisponible. Réessayez.",
            });
          }
          return;
        }

        const user = data.user as AuthUser;
        const adminPath = pathname === "/dashboard/administration"
          || pathname.startsWith("/dashboard/administration/")
          || pathname === "/dashboard/utilisateurs"
          || pathname.startsWith("/dashboard/utilisateurs/");
        const matchedModule = MODULE_PERMISSIONS
          .filter((entry) => pathname === entry.path || (
            entry.key !== "dashboard" && pathname.startsWith(`${entry.path}/`)
          ))
          .sort((left, right) => right.path.length - left.path.length)[0];

        if (
          (adminPath && user.role !== "ADMIN")
          || (matchedModule && user.role !== "ADMIN" && !user.modulePermissions?.includes(matchedModule.key))
        ) {
          router.replace("/403");
          return;
        }

        setAuthUser(user);
        if (active) {
          setGuard({ status: "ready", user });
        }
      } catch {
        if (active) {
          setGuard({
            status: "error",
            message: "Connexion au serveur impossible. Vérifiez votre connexion et réessayez.",
          });
        }
      }
    }

    void verifyAccess();
    return () => {
      active = false;
    };
  }, [pathname, retry, router]);

  if (guard.status === "checking") {
    return <PageLoader />;
  }

  if (guard.status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold text-dark">Vérification impossible</h1>
          <p className="mt-2 text-bodytext">{guard.message}</p>
          <button
            type="button"
            className="mt-4 rounded-xl bg-primary px-4 py-2 text-white"
            onClick={() => {
              setGuard({ status: "checking" });
              setRetry((current) => current + 1);
            }}
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <PermissionProvider user={guard.user}>
      {children}
    </PermissionProvider>
  );
}
