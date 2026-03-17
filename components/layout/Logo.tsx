/**
 * Logo.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Logo de l'application affiché en haut de la sidebar et sur la page de login.
 *
 * Le template utilisait un fichier SVG (logo.svg dans src/assets/).
 * Ici on utilise un logo texte simple pour éviter la dépendance à un fichier image.
 *
 * Ce composant est un Server Component (pas de "use client") car il n'a
 * aucun état interactif ni aucun hook navigateur.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Link from "next/link";

const Logo = () => {
  return (
    // Le logo est un lien vers le dashboard
    <Link href="/dashboard" className="flex items-center gap-2 no-underline">

      {/* Emblème circulaire avec les initiales */}
      <span className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
        TP
      </span>

      {/* Nom de l'application sur deux lignes */}
      <span className="flex flex-col leading-tight">
        <span className="font-bold text-dark dark:text-white text-base">
          Trésorerie
        </span>
        <span className="font-normal text-xs text-bodytext">
          Paroissiale
        </span>
      </span>

    </Link>
  );
};

export default Logo;
