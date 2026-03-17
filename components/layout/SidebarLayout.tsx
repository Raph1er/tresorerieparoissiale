"use client";
/**
 * SidebarLayout.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Sidebar principale du dashboard (version desktop uniquement, visible > 1280px).
 * Sur mobile, la sidebar s'affiche via un tiroir (Drawer) géré dans HeaderLayout.tsx.
 *
 * Adapté du Sidebar.tsx du template MatDash.
 * Changements par rapport au template :
 *   - Pas d'<Outlet> (Next.js render les children dans dashboard/layout.tsx)
 *   - Link de next/link via NavItems (pas react-router)
 *   - Supprimé : composant Upgrade (publicité pour la version payante)
 *   - SimpleBar : scrollbar personnalisée pour la liste des items
 *
 * Architecture :
 *   SidebarLayout (conteneur fixed)
 *     └─ Logo
 *     └─ SimpleBar (zone scrollable)
 *          └─ Sidebar (flowbite)
 *               └─ Sidebar.Items
 *                    └─ Section 1 (heading + items)
 *                    └─ Section 2 ...
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from "react";
import { Sidebar } from "flowbite-react";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css"; // styles CSS de la scrollbar personnalisée

import SidebarContent from "./SidebarItems";
import NavItems from "./NavItems";
import NavCollapse from "./NavCollapse";
import Logo from "./Logo";

const SidebarLayout = () => {
  return (
    // xl:block hidden → visible seulement à partir de 1280px (tailwind "xl")
    // Sur mobile, la sidebar est remplacée par un tiroir dans HeaderLayout
    <div className="xl:block hidden">

      {/* Sidebar flowbite : position fixed, largeur 256px, hauteur 100vh */}
      <Sidebar
        className="fixed menu-sidebar bg-white dark:bg-darkgray top-0 border-r border-border dark:border-darkborder"
        aria-label="Menu de navigation principal"
      >
        {/* ── Logo ──────────────────────────────────────────────────────── */}
        <div className="px-6 py-5 flex items-center">
          <Logo />
        </div>

        {/* ── Zone de défilement ────────────────────────────────────────── */}
        {/* SimpleBar remplace la scrollbar native par une scrollbar fine et élégante */}
        {/* h-[calc(100vh - 88px)] : pleine hauteur moins la zone du logo */}
        <SimpleBar className="h-[calc(100vh_-_88px)]">
          <Sidebar.Items className="px-5 py-2">
            <Sidebar.ItemGroup className="sidebar-nav hide-menu">

              {/* Itération sur les sections de navigation (ACCUEIL, FINANCES, etc.) */}
              {SidebarContent.map((section, index) => (
                <div className="caption" key={section.heading ?? index}>

                  {/* ── Titre de section ──────────────────────────────── */}
                  {/* Affiché en petites majuscules, séparé par une bordure supérieure */}
                  <h5 className="text-link dark:text-white/70 font-semibold leading-6 tracking-widest text-xs pb-2 uppercase">
                    {section.heading}
                  </h5>

                  {/* ── Items de la section ───────────────────────────── */}
                  {section.children?.map((child, childIndex) => (
                    <React.Fragment key={child.id ?? childIndex}>
                      {child.children
                        ? // Si l'item a des sous-items → groupe déroulant
                          <div className="collpase-items">
                            <NavCollapse item={child} />
                          </div>
                        : // Sinon → lien de navigation simple
                          <NavItems item={child} />
                      }
                    </React.Fragment>
                  ))}

                </div>
              ))}

            </Sidebar.ItemGroup>
          </Sidebar.Items>
        </SimpleBar>

      </Sidebar>
    </div>
  );
};

export default SidebarLayout;
