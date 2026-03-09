/**
 * Instance Prisma Client
 * Point d'accès centralisé à la base de données
 * Gère la connexion MySQL et les opérations CRUD
 * 
 * Ce fichier crée une instance singleton de PrismaClient
 * pour éviter les connexions multiples en développement
 */

import { PrismaClient } from '@prisma/client';

/**
 * Déclaration pour éviter la création multiple de PrismaClient en développement
 * En développement, Next.js rechauffe les modules, ce qui créerait plusieurs instances
 * Cette variable globalThis permet de réutiliser l'instance existante
 */
declare global {
  // Ajoute une propriété prisma au globalThis
  // TypeScript doit savoir que cette propriété existe
  var prisma: PrismaClient | undefined;
}

/**
 * Création ou récupération de l'instance PrismaClient
 * 
 * En production:
 * - Crée une nouvelle instance PrismaClient
 * - La variable globalThis.prisma n'est pas réutilisée (environnement clean)
 * 
 * En développement:
 * - Récupère l'instance existante de globalThis.prisma si elle existe
 * - Sinon, crée une nouvelle instance
 * - Cela évite les avertissements "multiple PrismaClient instances"
 */
const prisma =
  // Vérifie si on est en mode développement
  process.env.NODE_ENV === 'production'
    // En production: crée toujours une nouvelle instance
    ? new PrismaClient()
    // En développement: réutilise l'instance globale si elle existe
    : global.prisma ||
      // Sinon crée une nouvelle instance
      new PrismaClient({
        // Configuration optionnelle du logging
        log: [
          // Log les requêtes avec les variables liées
          'query',
          // Log les erreurs
          'error',
          // Log les avertissements
          'warn',
        ],
      });

/**
 * En développement uniquement:
 * Stocke l'instance dans globalThis pour la réutiliser au prochain rechargement
 * Cela évite de créer une nouvelle connexion à chaque hot-reload
 */
if (process.env.NODE_ENV !== 'production') {
  // Assigne l'instance au globalThis pour la persistance
  global.prisma = prisma;
}

/**
 * Export de l'instance PrismaClient
 * À utiliser dans tous les services et routes
 * 
 * Exemple d'utilisation:
 * ```typescript
 * import prisma from '@/lib/prisma';
 * 
 * const utilisateurs = await prisma.utilisateur.findMany();
 * ```
 */
export default prisma;