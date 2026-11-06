This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Configuration

The paroisse identity used in PDF reports is controlled by public environment variables.

- NEXT_PUBLIC_PAROISSE_REGION
- NEXT_PUBLIC_PAROISSE_SOUS_REGION
- NEXT_PUBLIC_PAROISSE_NOM
- NEXT_PUBLIC_PAROISSE_BP
- NEXT_PUBLIC_PAROISSE_CHARGE_PAROISSIAL

The weekly programme PDF uses these values for its parish letterhead and the
Paroissial Charge signature. The Secretary can download the currently displayed
programme at any time; empty fields are rendered as dotted lines. Standard and
first-Thursday programmes are formatted to fit on one landscape A4 page.

After downloading a programme, the Secretary can open a WhatsApp conversation
with a prefilled message containing a temporary PDF link. The message is not
sent automatically; the Secretary must confirm it in WhatsApp. The link expires
after 14 days. To enable sharing, create a **private** Supabase Storage bucket
named `programmes-pdf-temporaires`. The server uploads files using the existing
`SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`) and
`SUPABASE_SERVICE_ROLE_KEY` configuration, then creates a time-limited signed
URL. When the bucket contains 20 or more programme PDFs, the 10 oldest are
deleted. This cleanup runs when a new link is created; it is not a scheduled job,
and expired files may remain in private storage until that threshold is reached.

## Gestion des accès

Les permissions de modules sont stockées dans `permissions_modules`. Avant de déployer
la nouvelle gestion des accès, exécutez [`supabase/admin_permissions.sql`](./supabase/admin_permissions.sql)
dans le SQL Editor Supabase. Ce script crée la table protégée, initialise les accès
des comptes existants et installe la fonction RPC utilisée pour modifier les comptes
de façon atomique. La migration Prisma correspondante se trouve dans
`prisma/migrations/20261104103000_module_permissions`.

La clé `JWT_SECRET` doit être définie avec au moins 32 octets aléatoires. Le panneau
administrateur est disponible à `/dashboard/administration` pour le rôle `ADMIN`.
Une nouvelle entrée de menu sous `/dashboard/` est automatiquement ajoutée au
panneau à partir de son `id` (ou de son `permissionKey` explicite) ; son API doit
utiliser la même clé comme premier segment sous `/api/`. Les permissions absentes
en base sont refusées par défaut.
Depuis cet espace, un administrateur peut créer un compte avec son rôle, ses
modules et un mot de passe provisoire, ou modifier le rôle et les accès d'un
compte existant. L'utilisateur peut remplacer son mot de passe depuis son profil
en fournissant son mot de passe actuel.

Pour ajouter le rôle Secrétaire et initialiser les modèles de programme
standard, « Programme avec 1er Jeudi » et « Programme spécial de décembre »,
exécutez [`supabase/secretariat_programme_templates.sql`](./supabase/secretariat_programme_templates.sql)
dans le SQL Editor Supabase, puis réexécutez [`supabase/admin_permissions.sql`](./supabase/admin_permissions.sql)
pour mettre à jour les fonctions de gestion des rôles. Le script de programme est
idempotent : il crée ou met à jour le type, ses sections et les définitions de
champs, sans créer de programme hebdomadaire ni de contenu à remplir. Pour une
base MySQL gérée par Prisma, la migration correspondante est
`prisma/migrations/20261104150000_secretariat_programme_templates`.

L’administrateur choisit le modèle et le lundi, puis confirme explicitement
l’association de ce modèle à la semaine. Une seule association active existe par
semaine. Le Secrétaire choisit uniquement le lundi : le modèle associé est chargé
automatiquement; si aucun modèle n’est associé, le modèle standard est chargé
comme solution de secours avec un avertissement demandant de vérifier qu’il
correspond au programme prévu. Cette solution de secours ne crée pas d’association
officielle. Une réassociation par
l’administrateur conserve les anciennes fiches et leurs valeurs, mais les
secrétaires ouvrent désormais la fiche du nouveau modèle associé. L’administrateur
voit et modifie uniquement le thème et les lectures; le Secrétaire voit ces champs
en lecture seule et complète les officiants. Les officiants sont enregistrés
séparément pour chaque secrétaire, tandis que le thème et les lectures restent
partagés pour la semaine. Réexécutez le même script Supabase après la mise à jour
de la plateforme pour créer les tables des programmes, des saisies personnelles
et des associations semaine-modèle ainsi que les procédures de sauvegarde. Les
anciennes fiches sont associées automatiquement; si plusieurs fiches existaient
pour une semaine, la plus récemment modifiée devient l’association active.
Le modèle spécial de décembre conserve les cultes hebdomadaires et ajoute
automatiquement un culte à 04 h pour chaque date comprise entre le 18 et le
24 décembre inclus, ainsi qu’un culte annuel le 31 décembre à 22 h. Ce dernier
reprend la structure du culte du dimanche matin. Une semaine spéciale doit donc
chevaucher la plage du 18 au 24 décembre ou contenir le 31 décembre. Ces
calendriers sont définis par des règles annuelles en base; les dates concrètes
et les champs des cultes sont figés dans la fiche hebdomadaire lors de sa
création.
La migration Prisma du programme hebdomadaire est
`prisma/migrations/20261104160000_weekly_programmes`; celle des officiants propres
à chaque secrétaire est
`prisma/migrations/20261104180000_secretary_programme_values`.
La migration des associations semaine-modèle est
`prisma/migrations/20261105100000_programme_week_assignments`.
La migration du stockage des règles calendaires est
`prisma/migrations/20261105110000_calendar_template_rules`.

Copy [.env.example](.env.example) to .env.local and adjust those values to personalize the report headers.
