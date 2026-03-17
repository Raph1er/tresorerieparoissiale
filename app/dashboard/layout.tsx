/**
 * app/dashboard/layout.tsx — Layout du dashboard (FullLayout)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ce layout est appliqué à TOUTES les pages sous /dashboard/*.
 * Next.js l'applique automatiquement grâce au système de fichiers App Router.
 *
 * Équivalent Next.js du FullLayout.tsx du template MatDash.
 * Structure :
 *
 *   AuthGuard (vérifie le token JWT, redirige si expiré)
 *     └─ flex row
 *          ├─ SidebarLayout (menu latéral fixe, desktop only)
 *          └─ flex col  (zone principale, pousse après la sidebar via page-wrapper)
 *               ├─ HeaderLayout (barre du haut sticky)
 *               └─ zone de contenu (bg gris clair)
 *                    └─ {children} (la page active, ex: /dashboard/transactions)
 *
 * Ce composant est un Server Component (pas de "use client").
 * Ses enfants (SidebarLayout, HeaderLayout) sont Client Components.
 * Next.js gère automatiquement la frontière serveur/client.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { ReactNode } from "react";
import SidebarLayout from "@/components/layout/SidebarLayout";
import HeaderLayout from "@/components/layout/HeaderLayout";
import AuthGuard from "@/components/dashboard/AuthGuard";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    // AuthGuard : vérifie que le JWT est présent et non expiré.
    // Si non → redirige vers /login?next=/dashboard/...
    <AuthGuard>
      {/* Conteneur principal : flex row = sidebar à gauche + contenu à droite */}
      <div className="flex w-full min-h-screen dark:bg-darkgray">
        <div className="page-wrapper flex w-full">

          {/* ── Sidebar (visible > 1280px, position fixed) ────────────── */}
          {/* Sur mobile, la sidebar est dans un Drawer géré par HeaderLayout */}
          <SidebarLayout />

          {/* ── Zone de contenu principal ─────────────────────────────── */}
          {/* page-wrapper → margin-left: 256px (compense la sidebar fixe) */}
          {/* Sur mobile, page-wrapper → margin-left: 0 */}
          <div className="page-wrapper-sub flex flex-col w-full dark:bg-darkgray">

            {/* En-tête sticky (hamburger + profil + déconnexion) */}
            <HeaderLayout />

            {/* Fond gris clair de la zone de contenu */}
            <div className="bg-lightgray dark:bg-dark h-full rounded-bb">
              <div className="w-full">
                {/* Contenu de la page courante injecté par Next.js */}
                {/* container + py-30 → max-width 1200px + padding vertical 30px */}
                <div className="container py-30">
                  {children}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </AuthGuard>
  );
}