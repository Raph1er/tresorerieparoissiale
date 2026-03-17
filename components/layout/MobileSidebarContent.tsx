"use client";
/**
 * MobileSidebarContent.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Version mobile de la sidebar, affichée dans un tiroir (Drawer).
 * Identique à SidebarLayout en termes de contenu, mais sans position:fixed.
 *
 * Ce composant est rendu à l'intérieur du <Drawer> dans HeaderLayout.tsx.
 * Il est différent de SidebarLayout pour éviter les conflits de styles fixed.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from "react";
import { Sidebar } from "flowbite-react";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";

import SidebarContent from "./SidebarItems";
import NavItems from "./NavItems";
import NavCollapse from "./NavCollapse";
import Logo from "./Logo";

const MobileSidebarContent = () => {
  return (
    <div>
      {/* Logo affiché en haut du tiroir */}
      <div className="px-5 py-4">
        <Logo />
      </div>

      {/* Sidebar flowbite sans position fixed (la Drawer gère le positionnement) */}
      <Sidebar
        className="bg-transparent border-none shadow-none"
        aria-label="Menu de navigation mobile"
      >
        {/* Zone scrollable : pleine hauteur moins logo (~88px) */}
        <SimpleBar className="h-[calc(100vh_-_100px)]">
          <Sidebar.Items className="px-5">
            <Sidebar.ItemGroup className="sidebar-nav hide-menu">

              {SidebarContent.map((section, index) => (
                <div className="caption" key={section.heading ?? index}>
                  <h5 className="text-link dark:text-white/70 font-semibold leading-6 tracking-widest text-xs pb-2 uppercase">
                    {section.heading}
                  </h5>
                  {section.children?.map((child, childIndex) => (
                    <React.Fragment key={child.id ?? childIndex}>
                      {child.children
                        ? <div className="collpase-items"><NavCollapse item={child} /></div>
                        : <NavItems item={child} />
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

export default MobileSidebarContent;
