/**
 * Point d'entree BD pour l'application.
 *
 * Le code applicatif importe ce module pour utiliser Supabase.
 * L'implementation conserve une couche de compatibilite pour ne pas
 * reécrire toute la logique metier d'un coup.
 */

import supabaseDb from './prisma';

export default supabaseDb;
