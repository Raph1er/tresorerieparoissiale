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

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageClient />
    </Suspense>
  );
}
