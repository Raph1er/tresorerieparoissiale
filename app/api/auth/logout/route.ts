/**
 * Route POST /api/auth/logout
 * Gère la déconnexion des utilisateurs
 * Invalide le token et enregistre l'action d'audit
 * 
 * Note: Avec JWT, il n'y a pas de "stockage" du token côté serveur
 * Le client supprime simplement le token stocké localement
 * Ce endpoint enregistre l'action d'audit de la déconnexion
 */

import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification } from '@/middleware/auth.middleware';
import logger from '@/lib/logger';

/**
 * Fonction POST pour la déconnexion
 * @param request - La requête HTTP avec le token dans l'en-tête Authorization
 * @returns NextResponse - Confirmation de la déconnexion
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ================================================================
    // ÉTAPE 1 : Valider l'authentification de l'utilisateur
    // ================================================================

    // Appelle le middleware d'authentification pour vérifier le token
    // Si le token est invalide, retourne une erreur 401
    const contexte = await validerAuthentification(request);

    // Vérifie si la validation a échoué
    // Si contexte est une NextResponse, c'est une erreur
    if (contexte instanceof NextResponse) {
      return contexte;
    }

    // ================================================================
    // ÉTAPE 2 : Enregistrer la déconnexion dans l'audit
    // ================================================================

    // Log la déconnexion réussie pour la traçabilité
    // userId: l'ID de l'utilisateur qui se déconnecte
    // description: message descriptif
    await logger.log(
      'LOGOUT',
      `Déconnexion réussie pour l'utilisateur: ${contexte.email}`,
      contexte.userId
    );

    // ================================================================
    // ÉTAPE 3 : Retourner la réponse de succès
    // ================================================================

    // Retourne un code 200 (OK) indiquant que la déconnexion est réussie
    return NextResponse.json(
      {
        // Message de confirmation
        message: 'Déconnexion réussie',
        // Timestamp de la déconnexion
        deconnecteA: new Date().toISOString(),
      },
      { status: 200 }
    );

  } catch (error) {
    // ================================================================
    // GESTION DES ERREURS
    // ================================================================

    // Log l'erreur non prévue
    console.error('Erreur lors de la déconnexion:', error);

    // Enregistre l'erreur dans le journal d'audit
    await logger.log(
      'LOGOUT_ERROR',
      `Erreur lors de la déconnexion: ${error}`
    );

    // Retourne une erreur 500 (Internal Server Error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la déconnexion' },
      { status: 500 }
    );
  }
}