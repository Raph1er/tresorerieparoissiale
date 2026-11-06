/**
 * Route API pour les opérations sur un utilisateur spécifique
 * GET: Récupère les détails d'un utilisateur
 * PUT: Met à jour un utilisateur
 * DELETE: Supprime (désactive) un utilisateur
 */

import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification, validerRole } from '@/middleware/auth.middleware';
import { utilisateurService } from '@/modules/utilisateurs/utilisateur.service';
import { UpdateUtilisateurDTO } from '@/types/utilisateur';
import logger from '@/lib/logger';
import { MODULE_PERMISSIONS } from '@/lib/module-permissions';
import { supabaseServer } from '@/lib/supabase';
import {
  validerIdUtilisateur,
  validerUpdateUtilisateurDTO,
} from '@/validations/utilisateur.schema';

/**
 * Fonction utilitaire pour extraire l'ID des paramètres de route
 */
function extraireIdDeLaRoute(request: NextRequest): number {
  // Récupère l'URL complète
  const url = new URL(request.url);

  // Extrait le dernier segment du path (l'ID)
  const id = parseInt(url.pathname.split('/').pop() || '0', 10);

  return id;
}

/**
 * GET /api/utilisateurs/[id]
 * Récupère les détails d'un utilisateur spécifique
 * Autorisé pour: ADMIN, RESPONSABLE, AUDITEUR (et l'utilisateur lui-même)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // ================================================================
    // ÉTAPE 1 : Valider l'authentification
    // ================================================================

    const contexte = await validerAuthentification(request);

    if (contexte instanceof NextResponse) {
      return contexte;
    }

    // ================================================================
    // ÉTAPE 2 : Extraire l'ID
    // ================================================================

    const id = extraireIdDeLaRoute(request);

    // Valide que l'ID est valide
    const validationId = validerIdUtilisateur(id);
    if (!validationId.success) {
      return NextResponse.json(
        { erreur: validationId.error },
        { status: 400 }
      );
    }

    // ================================================================
    // ÉTAPE 3 : Vérifier les permissions
    // ================================================================

    // L'utilisateur peut voir:
    // - Ses propres informations
    // - Tout s'il est ADMIN ou RESPONSABLE
    const peutVoir = contexte.userId === id || contexte.role === 'ADMIN';

    if (!peutVoir) {
      return NextResponse.json(
        { erreur: 'Accès non autorisé' },
        { status: 403 }
      );
    }

    // ================================================================
    // ÉTAPE 4 : Récupérer l'utilisateur
    // ================================================================

    const utilisateur = await utilisateurService.getUtilisateurById(id);

    return NextResponse.json(utilisateur, { status: 200 });

  } catch (error) {
    // ================================================================
    // GESTION DES ERREURS
    // ================================================================

    if (error instanceof Error && error.message.includes('non trouvé')) {
      return NextResponse.json(
        { erreur: error.message },
        { status: 404 }
      );
    }

    console.error('Erreur GET utilisateur:', error);

    await logger.log('ERROR', `Erreur GET utilisateur: ${error}`);

    return NextResponse.json(
      { erreur: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/utilisateurs/[id]
 * Met à jour un utilisateur
 * Autorisé pour: ADMIN, ou l'utilisateur lui-même (modifications limitées)
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // ================================================================
    // ÉTAPE 1 : Valider l'authentification
    // ================================================================

    const contexte = await validerAuthentification(request);

    if (contexte instanceof NextResponse) {
      return contexte;
    }

    // ================================================================
    // ÉTAPE 2 : Extraire l'ID
    // ================================================================

    const id = extraireIdDeLaRoute(request);

    const validationId = validerIdUtilisateur(id);
    if (!validationId.success) {
      return NextResponse.json(
        { erreur: validationId.error },
        { status: 400 }
      );
    }

    // ================================================================
    // ÉTAPE 3 : Vérifier les permissions
    // ================================================================

    // Seul l'ADMIN peut modifier n'importe quel utilisateur
    // L'utilisateur peut modifier ses propres informations (limitées)
    const estAdmin = contexte.role === 'ADMIN';
    const estLuiMeme = contexte.userId === id;

    if (!estAdmin && !estLuiMeme) {
      return NextResponse.json(
        { erreur: 'Accès non autorisé' },
        { status: 403 }
      );
    }

    // ================================================================
    // ÉTAPE 4 : Extraire les données
    // ================================================================

    const body: unknown = await request.json();
    const validationBody = validerUpdateUtilisateurDTO(body);

    if (!validationBody.success) {
      return NextResponse.json(
        { erreur: validationBody.error },
        { status: 400 }
      );
    }

    const bodyValide = validationBody.data;

    // Si l'utilisateur n'est pas admin, il ne peut modifier que certains champs
    if (!estAdmin && estLuiMeme) {
      // L'utilisateur ne peut modifier que son nom et email
      const donnees: UpdateUtilisateurDTO = {};

      if (bodyValide.nom) {
        donnees.nom = bodyValide.nom;
      }

      if (bodyValide.email) {
        donnees.email = bodyValide.email;
      }

      // Si un non-admin essaie de modifier uniquement des champs interdits,
      // on bloque explicitement pour garder une API claire.
      if (!donnees.nom && !donnees.email) {
        return NextResponse.json(
          { erreur: 'Vous pouvez modifier uniquement nom et email' },
          { status: 403 }
        );
      }

      // Appelle le service avec les données limitées
      const utilisateurMiseAjour = await utilisateurService.updateUtilisateur(
        id,
        donnees,
        contexte.userId
      );

      return NextResponse.json(utilisateurMiseAjour, { status: 200 });
    }

    // ================================================================
    // ÉTAPE 5 : Mettre à jour l'utilisateur (ADMIN)
    // ================================================================

    if (bodyValide.role !== undefined || bodyValide.actif !== undefined) {
      if (id === contexte.userId) {
        return NextResponse.json(
          { erreur: 'Vous ne pouvez pas modifier votre propre rôle ou statut' },
          { status: 400 }
        );
      }

      const { error: erreurAcces } = await supabaseServer.rpc('rpc_admin_update_access', {
        p_actor_id: contexte.userId,
        p_target_id: id,
        p_actif: bodyValide.actif ?? null,
        p_role: bodyValide.role ?? null,
        p_module_keys: bodyValide.role === 'SECRETAIRE'
          ? ['dashboard', 'secretariat']
          : null,
        p_allowed_module_keys: MODULE_PERMISSIONS.map((module) => module.key),
      });

      if (erreurAcces) {
        if (erreurAcces.message.includes('LAST_ACTIVE_ADMIN')) {
          return NextResponse.json(
            { erreur: 'Le dernier administrateur actif ne peut pas être désactivé ou rétrogradé' },
            { status: 409 }
          );
        }
        if (erreurAcces.message.includes('USER_NOT_FOUND')) {
          return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 });
        }
        console.error('Erreur changement rôle/statut utilisateur:', erreurAcces);
        return NextResponse.json({ erreur: 'La modification des accès a échoué' }, { status: 500 });
      }
    }

    const utilisateurMiseAjour = await utilisateurService.updateUtilisateur(
      id,
      bodyValide,
      contexte.userId
    );

    return NextResponse.json(utilisateurMiseAjour, { status: 200 });

  } catch (error) {
    // ================================================================
    // GESTION DES ERREURS
    // ================================================================

    if (error instanceof Error) {
      if (error.message.includes('non trouvé')) {
        return NextResponse.json(
          { erreur: error.message },
          { status: 404 }
        );
      }

      if (error.message.includes('déjà utilisé')) {
        return NextResponse.json(
          { erreur: error.message },
          { status: 409 }
        );
      }
    }

    console.error('Erreur PUT utilisateur:', error);

    await logger.log('ERROR', `Erreur PUT utilisateur: ${error}`);

    return NextResponse.json(
      { erreur: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/utilisateurs/[id]
 * Supprime (désactive) un utilisateur
 * Autorisé pour: ADMIN uniquement
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // ================================================================
    // ÉTAPE 1 : Valider l'authentification
    // ================================================================

    const contexte = await validerAuthentification(request);

    if (contexte instanceof NextResponse) {
      return contexte;
    }

    // ================================================================
    // ÉTAPE 2 : Vérifier les permissions (ADMIN uniquement)
    // ================================================================

    const erreurRole = validerRole(contexte, ['ADMIN']);

    if (erreurRole) {
      return erreurRole;
    }

    // ================================================================
    // ÉTAPE 3 : Extraire l'ID
    // ================================================================

    const id = extraireIdDeLaRoute(request);

    const validationId = validerIdUtilisateur(id);
    if (!validationId.success) {
      return NextResponse.json(
        { erreur: validationId.error },
        { status: 400 }
      );
    }

    // ================================================================
    // ÉTAPE 4 : Supprimer l'utilisateur
    // ================================================================

    if (id === contexte.userId) {
      return NextResponse.json(
        { erreur: 'Vous ne pouvez pas désactiver votre propre compte' },
        { status: 400 }
      );
    }

    const { error: erreurAcces } = await supabaseServer.rpc('rpc_admin_update_access', {
      p_actor_id: contexte.userId,
      p_target_id: id,
      p_actif: false,
      p_role: null,
      p_module_keys: null,
      p_allowed_module_keys: MODULE_PERMISSIONS.map((module) => module.key),
    });

    if (erreurAcces) {
      if (erreurAcces.message.includes('LAST_ACTIVE_ADMIN')) {
        return NextResponse.json(
          { erreur: 'Le dernier administrateur actif ne peut pas être désactivé' },
          { status: 409 }
        );
      }
      if (erreurAcces.message.includes('USER_NOT_FOUND')) {
        return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 });
      }
      console.error('Erreur désactivation utilisateur:', erreurAcces);
      return NextResponse.json({ erreur: 'La désactivation a échoué' }, { status: 500 });
    }

    await logger.log(
      'USER_DISABLED',
      `Utilisateur ${id} désactivé`,
      contexte.userId,
      logger.extraireAdresseIP(request)
    );
    const utilisateurSupprime = await utilisateurService.getUtilisateurById(id);

    return NextResponse.json(utilisateurSupprime, { status: 200 });

  } catch (error) {
    // ================================================================
    // GESTION DES ERREURS
    // ================================================================

    if (error instanceof Error && error.message.includes('non trouvé')) {
      return NextResponse.json(
        { erreur: error.message },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message.includes('vous-même')) {
      return NextResponse.json(
        { erreur: error.message },
        { status: 400 }
      );
    }

    console.error('Erreur DELETE utilisateur:', error);

    await logger.log('ERROR', `Erreur DELETE utilisateur: ${error}`);

    return NextResponse.json(
      { erreur: 'Erreur serveur' },
      { status: 500 }
    );
  }
}