/**
 * Route API pour les utilisateurs
 * GET: Récupère la liste des utilisateurs (avec pagination et filtres)
 * POST: Crée un nouvel utilisateur (admin uniquement)
 */

import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification, validerRole } from '@/middleware/auth.middleware';
import { utilisateurService } from '@/modules/utilisateurs/utilisateur.service';
import { CreateUtilisateurDTO } from '@/types/utilisateur';
import {
  validerCreateUtilisateurDTO,
  validerPaginationUtilisateurQuery,
} from '@/validations/utilisateur.schema';
import logger from '@/lib/logger';

/**
 * GET /api/utilisateurs
 * Récupère la liste des utilisateurs avec pagination et filtres
 * Autorisé pour: ADMIN, RESPONSABLE, AUDITEUR
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // ================================================================
    // ÉTAPE 1 : Valider l'authentification
    // ================================================================

    // Vérifie que l'utilisateur est authentifié
    const contexte = await validerAuthentification(request);

    // Si l'authentification échoue
    if (contexte instanceof NextResponse) {
      return contexte;
    }

    // ================================================================
    // ÉTAPE 2 : Vérifier les permissions
    // ================================================================

    // Seuls les ADMIN et RESPONSABLE peuvent voir la liste
    const erreurRole = validerRole(contexte, [
      'ADMIN',
      'RESPONSABLE',
      'AUDITEUR',
    ]);

    if (erreurRole) {
      return erreurRole;
    }

    // ================================================================
    // ÉTAPE 3 : Extraire les paramètres de pagination et filtres
    // ================================================================

    // Récupère les paramètres de query
    const { searchParams } = new URL(request.url);

    // Valide les paramètres de pagination et filtres.
    const validationQuery = validerPaginationUtilisateurQuery(searchParams);
    if (!validationQuery.success) {
      return NextResponse.json(
        { erreur: validationQuery.error },
        { status: 400 }
      );
    }

    // ================================================================
    // ÉTAPE 5 : Récupérer les utilisateurs
    // ================================================================

    // Appelle le service pour récupérer les utilisateurs
    const resultat = await utilisateurService.getAllUtilisateurs(
      validationQuery.data.pagination,
      validationQuery.data.filters
    );

    // ================================================================
    // ÉTAPE 6 : Retourner la réponse
    // ================================================================

    return NextResponse.json(resultat, { status: 200 });

  } catch (error) {
    // ================================================================
    // GESTION DES ERREURS
    // ================================================================

    // Log l'erreur
    console.error('Erreur GET utilisateurs:', error);

    // Enregistre dans l'audit
    await logger.log('ERROR', `Erreur GET utilisateurs: ${error}`);

    // Retourne une erreur 500
    return NextResponse.json(
      { erreur: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/utilisateurs
 * Crée un nouvel utilisateur
 * Autorisé pour: ADMIN uniquement
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ================================================================
    // ÉTAPE 1 : Valider l'authentification
    // ================================================================

    // Vérifie que l'utilisateur est authentifié
    const contexte = await validerAuthentification(request);

    // Si l'authentification échoue
    if (contexte instanceof NextResponse) {
      return contexte;
    }

    // ================================================================
    // ÉTAPE 2 : Vérifier les permissions (ADMIN uniquement)
    // ================================================================

    // Seul l'ADMIN peut créer des utilisateurs
    const erreurRole = validerRole(contexte, ['ADMIN']);

    if (erreurRole) {
      return erreurRole;
    }

    // ================================================================
    // ÉTAPE 3 : Extraire et valider les données
    // ================================================================

    // Récupère le corps de la requête
    const body: unknown = await request.json();
    const validationBody = validerCreateUtilisateurDTO(body);
    if (!validationBody.success) {
      return NextResponse.json(
        { erreur: validationBody.error },
        { status: 400 }
      );
    }

    // ================================================================
    // ÉTAPE 4 : Créer l'utilisateur
    // ================================================================

    // Appelle le service pour créer l'utilisateur
    const payload: CreateUtilisateurDTO = validationBody.data;
    const nouvelUtilisateur = await utilisateurService.createUtilisateur(payload, contexte.userId);

    // ================================================================
    // ÉTAPE 5 : Retourner la réponse
    // ================================================================

    return NextResponse.json(nouvelUtilisateur, { status: 201 });

  } catch (error) {
    // ================================================================
    // GESTION DES ERREURS
    // ================================================================

    // Log l'erreur
    console.error('Erreur POST utilisateurs:', error);

    // Détermine le type d'erreur
    if (error instanceof Error) {
      // Erreur métier (email existant, mot de passe faible, etc.)
      if (
        error.message.includes('déjà utilisé') ||
        error.message.includes('au moins 8 caractères')
      ) {
        return NextResponse.json(
          { erreur: error.message },
          { status: 400 }
        );
      }
    }

    // Erreur serveur
    await logger.log('ERROR', `Erreur POST utilisateurs: ${error}`);

    return NextResponse.json(
      { erreur: 'Erreur serveur' },
      { status: 500 }
    );
  }
}