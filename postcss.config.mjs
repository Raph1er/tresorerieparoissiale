// PostCSS est l'outil qui transforme le CSS avant de l'envoyer au navigateur.
// Tailwind v3 utilise deux plugins ici :
//   - tailwindcss : génère les classes utilitaires à partir de tailwind.config.ts
//   - autoprefixer : ajoute automatiquement les préfixes vendeurs (-webkit-, -moz-...)
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
