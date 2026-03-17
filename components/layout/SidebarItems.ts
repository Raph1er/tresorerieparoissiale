/**
 * SidebarItems.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Données de navigation de la sidebar.
 * Ce fichier déclare QUELS liens apparaissent dans le menu latéral et dans quel
 * ordre/groupe. C'est le seul endroit à modifier pour ajouter/retirer une page.
 *
 * Structure :
 *   MenuItem → groupe de liens avec un titre de section (ex: "FINANCES")
 *   ChildItem → un lien unique (nom, icône Iconify, URL)
 *
 * Icônes : on utilise la bibliothèque "Solar" via Iconify.
 *   Format : "solar:<nom>-line-duotone"  ou  "solar:<nom>-bold-duotone"
 *   Catalogue : https://icon-sets.iconify.design/solar/
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Un élément enfant du menu (lien simple ou groupe avec sous-items) */
export interface ChildItem {
  id?: string;
  name?: string;
  icon?: string;          // identifiant Iconify ex: "solar:widget-add-line-duotone"
  children?: ChildItem[]; // si présent → groupe déroulant (NavCollapse)
  url?: string;           // chemin Next.js ex: "/dashboard/transactions"
}

/** Un groupe de liens avec un titre de section */
export interface MenuItem {
  heading?: string;       // titre affiché en petit caps (ex: "FINANCES")
  children?: ChildItem[];
}

// ── Navigation ────────────────────────────────────────────────────────────────

/** Structure complète du menu latéral de l'application de trésorerie */
const SidebarContent: MenuItem[] = [
  // ── Section 1 : Vue d'ensemble ────────────────────────────────────────
  {
    heading: "ACCUEIL",
    children: [
      {
        name: "Tableau de bord",
        icon: "solar:widget-add-line-duotone",
        id: "dashboard",
        url: "/dashboard",
      },
    ],
  },

  // ── Section 2 : Gestion financière ───────────────────────────────────
  {
    heading: "FINANCES",
    children: [
      {
        name: "Transactions",
        icon: "solar:card-transfer-line-duotone",
        id: "transactions",
        url: "/dashboard/transactions",
      },
      {
        name: "Dîmes",
        icon: "solar:hand-money-line-duotone",
        id: "dimes",
        url: "/dashboard/dimes",
      },
      {
        name: "Catégories",
        icon: "solar:folder-with-files-line-duotone",
        id: "categories",
        url: "/dashboard/categories",
      },
    ],
  },

  // ── Section 3 : Organisation ──────────────────────────────────────────
  {
    heading: "ORGANISATION",
    children: [
      {
        name: "Événements",
        icon: "solar:calendar-mark-line-duotone",
        id: "evenements",
        url: "/dashboard/evenements",
      },
      {
        name: "Rapports",
        icon: "solar:chart-square-line-duotone",
        id: "rapports",
        url: "/dashboard/rapports",
      },
    ],
  },

  // ── Section 4 : Administration ────────────────────────────────────────
  {
    heading: "ADMINISTRATION",
    children: [
      {
        name: "Utilisateurs",
        icon: "solar:users-group-rounded-line-duotone",
        id: "utilisateurs",
        url: "/dashboard/utilisateurs",
      },
    ],
  },
];

export default SidebarContent;
