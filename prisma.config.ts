// prisma.config.ts

import "dotenv/config";

// Prisma 5.22 utilisé dans ce projet n'expose pas le helper `prisma/config`.
// On garde donc une configuration simple exportée en objet pour documenter
// le schéma, les migrations et la datasource sans casser le build Next.js.
const prismaConfig = {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
};

export default prismaConfig;