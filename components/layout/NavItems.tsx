"use client";
/**
 * NavItems.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Composant qui affiche UN SEUL lien de navigation dans la sidebar.
 *
 * Adapté du NavItems du template MatDash.
 * Changements par rapport au template :
 *   - `import { Link } from "react-router"` → `import Link from "next/link"`
 *   - `useLocation()` de react-router → `usePathname()` de next/navigation
 *   - `to={item.url}` → `href={item.url}` (syntaxe Next.js Link)
 *
 * Le lien devient violet (bg-primary) quand son URL = le chemin actuel.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from "react";
import Link from "next/link";                // ← Next.js Link (pas react-router)
import { usePathname } from "next/navigation"; // ← Next.js hook (pas useLocation)
import { Sidebar } from "flowbite-react";
import { Icon } from "@iconify/react";
import { ChildItem } from "./SidebarItems";

interface NavItemsProps {
  item: ChildItem;
}

const NavItems: React.FC<NavItemsProps> = ({ item }) => {
  // usePathname() retourne le chemin courant, ex: "/dashboard/transactions"
  // On compare avec l'URL de l'item pour détecter le lien actif
  const pathname = usePathname();
  const isActive = item.url === pathname;

  return (
    <Sidebar.Item
      href={item.url}   // Next.js Link utilise "href" (react-router utilisait "to")
      as={Link}         // flowbite délègue le rendu de l'<a> au composant Link de Next.js
      className={
        isActive
          // Lien actif : fond violet, texte blanc, ombre
          ? "text-white bg-primary rounded-xl hover:text-white hover:bg-primary dark:hover:text-white shadow-btnshdw"
          // Lien inactif : transparent, texte link (gris foncé)
          : "text-link bg-transparent group/link"
      }
    >
      <div className="flex items-center justify-between">
        <span className="flex gap-3 items-center">
          {item.icon ? (
            // Icône Iconify Solar (ex: "solar:card-transfer-line-duotone")
            <Icon icon={item.icon} className="text-current" height={18} />
          ) : (
            // Petit point si pas d'icône (pour les sous-items sans icône)
            <span
              className={
                isActive
                  ? "dark:bg-white rounded-full mx-1.5 !bg-primary h-[6px] w-[6px]"
                  : "h-[6px] w-[6px] bg-black/40 dark:bg-white rounded-full mx-1.5 group-hover/link:bg-primary"
              }
            />
          )}
          <span className="max-w-28 truncate">{item.name}</span>
        </span>
      </div>
    </Sidebar.Item>
  );
};

export default NavItems;
