"use client";
/**
 * NavCollapse.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Groupe de navigation déroulant : un bouton en-tête + une liste d'items enfants.
 *
 * Adapté du NavCollapse du template MatDash.
 * Changement principal : `useLocation()` de react-router → `usePathname()` de Next.js.
 *
 * Fonctionnement :
 *   1. Au chargement, vérifie si un enfant correspond au chemin actuel
 *      → si oui, le groupe s'ouvre automatiquement
 *   2. Au clic sur l'en-tête : bascule ouvert/fermé
 *   3. Supporte la récursivité (sous-groupes dans sous-groupes)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState } from "react";
import { usePathname } from "next/navigation"; // ← Next.js (pas useLocation de react-router)
import { ChildItem } from "./SidebarItems";
import NavItems from "./NavItems";
import { CustomCollapse } from "./CustomCollapse";

interface NavCollapseProps {
  item: ChildItem;
}

const NavCollapse: React.FC<NavCollapseProps> = ({ item }) => {
  const pathname = usePathname();

  // Vérifie si un des sous-items correspond au chemin actuel.
  // Si oui, on initialise le groupe en état "ouvert" pour que l'utilisateur
  // voie directement sa position dans le menu.
  const isChildActive = item.children?.some((child) => child.url === pathname);

  // État local : ouvert ou fermé
  // !!isChildActive → true si un enfant est actif, false sinon
  const [isOpen, setIsOpen] = useState<boolean>(!!isChildActive);

  return (
    <CustomCollapse
      label={item.name ?? ""}
      open={isOpen}
      onClick={() => setIsOpen((prev) => !prev)} // bascule à chaque clic
      icon={item.icon ?? "solar:widget-add-line-duotone"}
      className={
        isChildActive
          // Un enfant est actif → l'en-tête prend l'apparence "active" (fond violet)
          ? "!text-white bg-primary rounded-xl hover:bg-primary hover:text-white shadow-btnshdw"
          // Aucun enfant actif → apparence normale
          : "rounded-xl dark:text-white/80 hover:text-primary"
      }
    >
      <div className="sidebar-dropdown">
        {item.children?.map((child) => (
          <React.Fragment key={child.id}>
            {child.children
              ? // Sous-groupe déroulant (récursif) si l'enfant a lui-même des enfants
                <NavCollapse item={child} />
              : // Lien simple sinon
                <NavItems item={child} />
            }
          </React.Fragment>
        ))}
      </div>
    </CustomCollapse>
  );
};

export default NavCollapse;
