/**
 * tailwind.config.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuration Tailwind CSS v3 pour l'application de trésorerie paroissiale.
 * Repris et adapté du tailwind.config.ts du template MatDash pour Next.js.
 *
 * Points importants :
 *  1. darkMode: "class" → le mode sombre s'active via <html class="dark">
 *  2. content       → chemins où Tailwind scanne les classes utilisées (tree-shaking CSS)
 *  3. colors        → chaque couleur pointe vers une variable CSS (:root dans globals.css)
 *                     → changer --color-primary dans globals.css suffit pour tout recolorer
 *  4. flowbite      → plugin qui génère les styles des composants (Sidebar, Button, Drawer…)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Config } from "tailwindcss";

// flowbite-react v0.10.x fournit un helper "tailwind" qui expose :
//   .content() → les chemins de ses propres composants (pour tree-shaking)
//   .plugin()  → le plugin PostCSS qui génère les styles flowbite
const flowbite = require("flowbite-react/tailwind");

const config: Config = {
  // ── Mode sombre ─────────────────────────────────────────────────────────────
  // "class" : le mode sombre s'active manuellement (bouton toggle dans le header)
  // "media" : suivrait automatiquement les préférences système de l'utilisateur
  darkMode: "class",

  // ── Chemins à scanner ───────────────────────────────────────────────────────
  // Tailwind ne génère QUE les classes trouvées dans ces fichiers → CSS minimal en prod
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",        // pages et layouts Next.js
    "./components/**/*.{js,ts,jsx,tsx,mdx}", // composants partagés
    "./modules/**/*.{js,ts,jsx,tsx,mdx}",    // modules métier
    flowbite.content(),                       // composants internes de flowbite-react
  ],

  theme: {
    // ── Police de caractères ───────────────────────────────────────────────────
    // "sans" est la police par défaut de Tailwind ; on la remplace par Manrope
    // (chargée dans globals.css via Google Fonts)
    fontFamily: {
      sans: ["Manrope", "system-ui", "serif"],
    },

    extend: {
      // ── Ombres ────────────────────────────────────────────────────────────────
      boxShadow: {
        md: "0px 2px 4px -1px rgba(175, 182, 201, 0.2)",
        "dark-md": "rgba(145, 158, 171, 0.3) 0px 0px 2px 0px, rgba(145, 158, 171, 0.02) 0px 12px 24px -4px",
        sm: "0 6px 24.2px -10px rgba(41, 52, 61, .22)",
        btnshdw: "0 17px 20px -8px rgba(77, 91, 236, .231372549)",
        elevation1: "0px 12px 30px -2px rgba(58,75,116,0.14)",
        elevation2: "0px 24px 24px -12px rgba(0,0,0,0.05)",
      },

      // ── Rayons de bordure ────────────────────────────────────────────────────
      // "bb" et "tw" sont des tokens du template qu'on réutilise dans les layouts
      borderRadius: {
        sm: "6px",
        md: "9px",
        lg: "24px",
        tw: "12px",
        bb: "20px",
      },

      // ── Espacements personnalisés ────────────────────────────────────────────
      // "30" = 30px (Tailwind v3 n'a pas ce token par défaut ; p-30, py-30, etc.)
      padding: { "30": "30px" },
      margin: { "30": "30px" },
      gap: { "30": "30px" },

      // ── Tailles de police ────────────────────────────────────────────────────
      fontSize: {
        "13": "13px",
        "15": "15px",
        "17": "17px",
        "22": "22px",
      },

      // ── Couleurs du thème ────────────────────────────────────────────────────
      // Toutes les couleurs pointent vers des variables CSS déclarées dans globals.css.
      // Avantage : pour changer le thème, il suffit de modifier les variables :root.
      // Exemple : bg-primary → utilise var(--color-primary)
      colors: {
        primary: "var(--color-primary)",
        secondary: "var(--color-secondary)",
        info: "var(--color-info)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        error: "var(--color-error)",
        lightprimary: "var(--color-lightprimary)",
        lightsecondary: "var(--color-lightsecondary)",
        lightsuccess: "var(--color-lightsuccess)",
        lighterror: "var(--color-lighterror)",
        lightinfo: "var(--color-lightinfo)",
        lightwarning: "var(--color-lightwarning)",
        dark: "var(--color-dark)",
        border: "var(--color-border)",
        darkborder: "var(--color-darkborder)",
        link: "var(--color-link)",
        muted: "var(--color-muted)",
        darkmuted: "var(--color-darkmuted)",
        lightgray: "var(--color-lightgray)",
        darkgray: "var(--color-darkgray)",
        lighthover: "var(--color-lighthover)",
        bodytext: "var(--color-bodytext)",
        // flowbite-react utilise la couleur "cyan" comme couleur principale par défaut.
        // On la remappe vers notre couleur primaire pour que les boutons, focus, etc.
        // utilisent notre violet #635BFF au lieu du cyan par défaut.
        cyan: {
          "500": "var(--color-primary)",
          "600": "var(--color-primary)",
          "700": "var(--color-primary)",
        },
      },
    },
  },

  // ── Plugins ──────────────────────────────────────────────────────────────────
  // flowbite.plugin() enregistre les styles des composants Flowbite (Sidebar, Badge, etc.)
  plugins: [flowbite.plugin()],
};

export default config;
