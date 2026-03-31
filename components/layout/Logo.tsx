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
import Image from "next/image";

const Logo = () => {
  return (
    // Le logo est un lien vers le dashboard
    <Link href="/dashboard" className="flex items-center gap-2 no-underline">

      {/* Emblème circulaire avec le logo de la paroisse */}
      <span className="h-10 w-10 rounded-full bg-white border border-border dark:border-darkborder flex items-center justify-center overflow-hidden flex-shrink-0">
        <Image
          src="/logo-ecc.webp"
          alt="Logo de la paroisse"
          width={36}
          height={36}
          className="h-9 w-9 object-contain"
          priority
        />
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
