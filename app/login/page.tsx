/**
 * app/login/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Wrapper serveur de la page de connexion.
 *
 * Next.js 16 exige qu'un composant qui utilise `useSearchParams()` soit rendu
 * derrière une frontière `Suspense`. On garde donc ici un composant serveur
 * très léger qui délègue toute la logique interactive au composant client
 * `LoginPageClient`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Suspense } from "react";
import LoginPageClient from "@/components/auth/LoginPageClient";

function LoginFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-lightgray px-4">
      <div className="rounded-xl bg-white shadow-md px-6 py-5 text-sm text-bodytext">
        Chargement de l'espace de connexion...
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageClient />
    </Suspense>
  );
}
