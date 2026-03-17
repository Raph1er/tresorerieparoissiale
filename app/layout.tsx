/**
 * app/layout.tsx — Layout racine Next.js (RootLayout)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ce composant enveloppe TOUTES les pages de l'application.
 * Il charge le CSS global (Tailwind + thème MatDash) et définit la structure HTML.
 *
 * Note sur les polices :
 *   La police Manrope est chargée directement dans globals.css via @import Google Fonts.
 *   On n'utilise plus next/font ici pour rester cohérent avec l'approche du template.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trésorerie Paroisse",
  description: "Plateforme de gestion financière paroissiale",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // lang="fr" pour le français
    // suppressHydrationWarning évite l'erreur React liée au mode sombre qui
    // modifie la classe <html> côté client (dark/light) avant l'hydratation Next.js
    <html lang="fr" suppressHydrationWarning>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
