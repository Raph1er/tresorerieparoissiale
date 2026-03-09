/**
 * Middleware d'authentification
 * Vérifie que l'utilisateur possède un token JWT valide
 * Extrait et valide le token depuis l'en-tête Authorization
 */

import { NextRequest, NextResponse } from 'next/server';
import { extraireToken, verifierToken } from '@/lib/auth';
import logger from '@/lib/logger';

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

    // Crée le contexte d'authentification avec les données du token
    // Ce contexte sera utilisé par les contrôleurs pour connaître l'utilisateur
    const contexte: ContexteAuth = {
      // ID extrait du token
      userId: payload.userId,
      // Email extrait du token
      email: payload.email,
      // Rôle extrait du token
      role: payload.role,
    };

    // Retourne le contexte d'authentification valide
    return contexte;

  } catch (error) {
    // En cas d'erreur imprévisible
    // Log l'erreur pour debug
    console.error('Erreur middleware authentification:', error);

    // Log l'erreur dans le système d'audit
    await logger.log(
      'AUTH_ERROR',
      `Erreur middleware: ${error}`
    );

    // Retourne une erreur 500 (Internal Server Error)
    return NextResponse.json(
      { erreur: 'Erreur d\'authentification' },
      { status: 500 }
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