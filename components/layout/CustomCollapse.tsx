"use client";
/**
 * CustomCollapse.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Bouton d'en-tête cliquable pour un groupe déroulant dans la sidebar.
 * Le contenu (les items enfants) se cache/affiche via une animation CSS.
 *
 * Ce composant est "headless" (sans données) : il ne fait qu'afficher un
 * bouton + son contenu. La logique open/close est gérée par NavCollapse.tsx.
 *
 * Repris tel quel du template (aucune dépendance react-router).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from "react";
import { twMerge } from "tailwind-merge";  // fusionne les classes Tailwind sans conflits
import { ChevronDown } from "lucide-react"; // icône flèche avec types natifs
import { Icon } from "@iconify/react";

interface CustomCollapseProps {
  label: string;            // texte affiché (ex: "Finances")
  open: boolean;            // true = groupe ouvert, false = fermé
  children: React.ReactNode;
  onClick: () => void;      // callback pour basculer open/close
  icon: string;             // identifiant Iconify
  className?: string;       // classes supplémentaires (pour le style "actif")
}

const CustomCollapse: React.FC<CustomCollapseProps> = ({
  label,
  open,
  onClick,
  icon,
  children,
  className,
}) => {
  return (
    <div className={twMerge("transition-all duration-300")}>

      {/* ── En-tête cliquable ─────────────────────────────────────────────── */}
      <div
        className={twMerge(
          // Classes de base : apparence du bouton de groupe
          "flex cursor-pointer mb-1 items-center justify-between rounded-lg px-4 py-[11px] gap-3 text-[15px] leading-normal font-normal text-link nav-cover hover:text-primary dark:text-white dark:hover:text-primary",
          // Classes dynamiques passées en prop (ex: bg-primary quand un enfant est actif)
          className
        )}
        onClick={onClick}
      >
        <div className="flex items-center gap-3">
          <Icon icon={icon} height={18} />
          <span className="truncate max-w-28 nav-label">{label}</span>
        </div>

        {/* Flèche qui pivote de 180° quand le groupe est ouvert */}
        <ChevronDown
          className={twMerge(
            "transform transition-transform",
            open ? "rotate-180" : "rotate-0"
          )}
        />
      </div>

      {/* ── Contenu (items enfants) ───────────────────────────────────────── */}
      {/* max-h-0 → max-h-screen : animation d'apparition CSS sans JavaScript */}
      <div
        className={twMerge(
          "overflow-hidden transition-all duration-300",
          open ? "max-h-screen" : "max-h-0"
        )}
      >
        {children}
      </div>

    </div>
  );
};

export { CustomCollapse };
