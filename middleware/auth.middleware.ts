/**
 * Middleware d'authentification
 * Vérifie que l'utilisateur possède un token JWT valide
 * Extrait et valide le token depuis l'en-tête Authorization
 */

import { NextRequest, NextResponse } from 'next/server';
import { extraireToken, verifierToken } from '@/lib/auth';
import logger from '@/lib/logger';
import { MODULE_PERMISSIONS, obtenirPermissionModulePourRoute } from '@/lib/module-permissions';
import { supabaseServer } from '@/lib/supabase';
import { estErreurIndisponibiliteService, formaterErreurServeur } from '@/lib/service-errors';

/**
 * Interface pour le contexte d'authentification
 * Attachée à la requête après validation du token
 */
export interface ContexteAuth {
  // Identifiant de l'utilisateur authentifié
  userId: number;
  // Email de l'utilisateur
  email: string;
  // Rôle de l'utilisateur (ADMIN, TRESORIER, RESPONSABLE, AUDITEUR)
  role: string;
  nom: string;
  modulePermissions: string[];
}

/**
 * Fonction middleware pour valider l'authentification
 * À utiliser dans les routes protégées
 * @param request - La requête HTTP entrante
 * @returns ContexteAuth | NextResponse - Le contexte auth ou une erreur
 */
export async function validerAuthentification(
  request: NextRequest
): Promise<ContexteAuth | NextResponse> {
  try {
    // Récupère l'en-tête Authorization de la requête
    // Format attendu: "Bearer <token>"
    const authHeader = request.headers.get('Authorization');

    // Vérifie que l'en-tête Authorization est présent
    if (!authHeader) {
      // Log la tentative d'accès sans token
      await logger.log(
        'AUTH_MISSING',
        'Tentative d\'accès sans token Authorization'
      );

      // Retourne une erreur 401 (Unauthorized)
      return NextResponse.json(
        { erreur: 'Token manquant' },
        { status: 401 }
      );
    }

    // Extrait le token depuis l'en-tête (supprime "Bearer ")
    // Retourne null si le format n'est pas valide
    const token = extraireToken(authHeader);

    // Vérifie que le token a été extrait correctement
    if (!token) {
      // Log le format invalide
      await logger.log(
        'AUTH_INVALID_FORMAT',
        'Format Authorization invalide'
      );

      // Retourne une erreur 401 avec message explicite
      return NextResponse.json(
        { erreur: 'Format Authorization invalide' },
        { status: 401 }
      );
    }

    // Vérifie et décode le token JWT
    // Valide la signature et l'expiration
    const payload = verifierToken(token);

    // Vérifie que le token est valide
    if (!payload) {
      // Log l'échec de la vérification du token
      await logger.log(
        'AUTH_INVALID_TOKEN',
        'Token invalide ou expiré'
      );

      // Retourne une erreur 401 (token expiré ou invalide)
      return NextResponse.json(
        { erreur: 'Token invalide ou expiré' },
        { status: 401 }
      );
    }

    if (!Number.isSafeInteger(payload.userId) || payload.userId <= 0) {
      return NextResponse.json({ erreur: 'Token invalide' }, { status: 401 });
    }

    const { data: utilisateur, error: erreurUtilisateur } = await supabaseServer
      .from('utilisateurs')
      .select('id, nom, email, role, actif')
      .eq('id', payload.userId)
      .maybeSingle();

    if (erreurUtilisateur) {
      throw erreurUtilisateur;
    }

    if (!utilisateur || !utilisateur.actif) {
      await logger.log(
        'AUTH_FORBIDDEN',
        `Compte absent ou désactivé: ${payload.userId}`,
        payload.userId
      );
      return NextResponse.json(
        { erreur: 'Compte désactivé ou introuvable', code: 'ACCOUNT_DISABLED' },
        { status: 403 }
      );
    }

    let modulePermissions: string[];
    if (utilisateur.role === 'ADMIN') {
      modulePermissions = MODULE_PERMISSIONS.map((module) => module.key);
    } else {
      const { data: permissions, error: erreurPermissions } = await supabaseServer
        .from('permissions_modules')
        .select('module_key')
        .eq('utilisateur_id', utilisateur.id);

      if (erreurPermissions) {
        throw erreurPermissions;
      }

      modulePermissions = (permissions ?? []).map((permission) => permission.module_key);
    }

    const permissionModule = obtenirPermissionModulePourRoute(request.nextUrl.pathname);
    if (
      permissionModule &&
      utilisateur.role !== 'ADMIN' &&
      !modulePermissions.includes(permissionModule)
    ) {
      await logger.log(
        'AUTH_FORBIDDEN',
        `Accès au module ${permissionModule} refusé pour l'utilisateur ${utilisateur.id}`,
        utilisateur.id,
        logger.extraireAdresseIP(request)
      );
      return NextResponse.json(
        { erreur: 'Vous n’avez pas accès à ce module' },
        { status: 403 }
      );
    }

    const contexte: ContexteAuth = {
      userId: utilisateur.id,
      email: utilisateur.email,
      role: utilisateur.role,
      nom: utilisateur.nom,
      modulePermissions,
    };

    // Retourne le contexte d'authentification valide
    return contexte;

  } catch (error) {
    const serviceIndisponible = estErreurIndisponibiliteService(error);
    console.error(
      serviceIndisponible
        ? 'Service de base de données indisponible pendant l’authentification'
        : 'Erreur middleware authentification',
      formaterErreurServeur(error)
    );

    return NextResponse.json(
      {
        erreur: serviceIndisponible
          ? 'Le service de données est temporairement indisponible. Réessayez dans quelques instants.'
          : 'La vérification de votre session a échoué.',
        code: serviceIndisponible ? 'SERVICE_UNAVAILABLE' : 'AUTHENTICATION_ERROR',
      },
      {
        status: serviceIndisponible ? 503 : 500,
        headers: serviceIndisponible
          ? { 'Retry-After': '5', 'Cache-Control': 'no-store' }
          : { 'Cache-Control': 'no-store' },
      }
    );
  }
}

/**
 * Fonction middleware pour valider un rôle spécifique
 * À utiliser après validerAuthentification
 * @param contexte - Le contexte d'authentification
 * @param rolesAutorises - Les rôles autorisés pour cette route
 * @returns NextResponse | null - Une erreur si le rôle n'est pas autorisé, null sinon
 */
export function validerRole(
  contexte: ContexteAuth,
  rolesAutorises: string[]
): NextResponse | null {
  // Vérifie que le rôle de l'utilisateur est dans la liste des rôles autorisés
  // La comparaison est sensible à la casse
  if (!rolesAutorises.includes(contexte.role)) {
    // Log l'accès non autorisé
    logger.log(
      'AUTH_FORBIDDEN',
      `Accès refusé pour l'utilisateur ${contexte.userId} avec rôle ${contexte.role}`
    );

    // Retourne une erreur 403 (Forbidden - Accès refusé)
    return NextResponse.json(
      { erreur: 'Accès non autorisé pour ce rôle' },
      { status: 403 }
    );
  }

  // Le rôle est autorisé, retourne null (aucune erreur)
  return null;
}