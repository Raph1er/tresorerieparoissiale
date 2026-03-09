/**
 * Route API pour les opérations sur un évènement précis.
 * GET: récupérer un évènement.
 * PUT: mettre à jour un évènement.
 * DELETE: suppression logique d'un évènement.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification, validerRole } from '@/middleware/auth.middleware';
import { evenementService } from '@/modules/evenements/evenement.service';
import logger from '@/lib/logger';
import { validerIdEvenement, validerUpdateEvenementDTO } from '@/validations/evenement.schema';

/**
 * Extrait l'identifiant numérique depuis l'URL /api/evenements/[id].
 */
function extraireIdDepuisRoute(request: NextRequest): number {
  const url = new URL(request.url);
  return parseInt(url.pathname.split('/').pop() || '0', 10);
}

/**
 * GET /api/evenements/[id]
 * Autorisé pour: ADMIN, RESPONSABLE, TRESORIER, AUDITEUR
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 1) Authentification.
    const contexte = await validerAuthentification(request);
    if (contexte instanceof NextResponse) {
      return contexte;
    }

    // 2) Vérification du rôle pour la consultation.
    const erreurRole = validerRole(contexte, [
      'ADMIN',
      'RESPONSABLE',
      'TRESORIER',
      'AUDITEUR',
    ]);
    if (erreurRole) {
      return erreurRole;
    }

    // 3) Validation de l'ID.
    const id = extraireIdDepuisRoute(request);
    const validationId = validerIdEvenement(id);
    if (!validationId.success) {
      return NextResponse.json({ erreur: validationId.error }, { status: 400 });
    }

    // 4) Lecture via service.
    const evenement = await evenementService.getEvenementById(id);
    return NextResponse.json(evenement, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('introuvable')) {
      return NextResponse.json({ erreur: error.message }, { status: 404 });
    }

    console.error('Erreur GET /api/evenements/[id]:', error);
    await logger.log('ERROR', `Erreur GET /api/evenements/[id]: ${error}`);

    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * PUT /api/evenements/[id]
 * Autorisé pour: ADMIN, RESPONSABLE, TRESORIER
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // 1) Authentification.
    const contexte = await validerAuthentification(request);
    if (contexte instanceof NextResponse) {
      return contexte;
    }

    // 2) Vérification du rôle pour la modification.
    const erreurRole = validerRole(contexte, ['ADMIN', 'RESPONSABLE', 'TRESORIER']);
    if (erreurRole) {
      return erreurRole;
    }

    // 3) Validation de l'ID.
    const id = extraireIdDepuisRoute(request);
    const validationId = validerIdEvenement(id);
    if (!validationId.success) {
      return NextResponse.json({ erreur: validationId.error }, { status: 400 });
    }

    // 4) Validation du payload de mise à jour.
    const body: unknown = await request.json();
    const validationBody = validerUpdateEvenementDTO(body);
    if (!validationBody.success) {
      return NextResponse.json({ erreur: validationBody.error }, { status: 400 });
    }

    // 5) Mise à jour métier.
    const evenementMiseAJour = await evenementService.updateEvenement(
      id,
      validationBody.data,
      contexte.userId
    );

    return NextResponse.json(evenementMiseAJour, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('introuvable')) {
        return NextResponse.json({ erreur: error.message }, { status: 404 });
      }

      if (
        error.message.includes('existe déjà') ||
        error.message.includes('date') ||
        error.message.includes('Impossible')
      ) {
        return NextResponse.json({ erreur: error.message }, { status: 400 });
      }
    }

    console.error('Erreur PUT /api/evenements/[id]:', error);
    await logger.log('ERROR', `Erreur PUT /api/evenements/[id]: ${error}`);

    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * DELETE /api/evenements/[id]
 * Autorisé pour: ADMIN uniquement.
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // 1) Authentification.
    const contexte = await validerAuthentification(request);
    if (contexte instanceof NextResponse) {
      return contexte;
    }

    // 2) Vérification du rôle pour la suppression.
    const erreurRole = validerRole(contexte, ['ADMIN']);
    if (erreurRole) {
      return erreurRole;
    }

    // 3) Validation de l'ID.
    const id = extraireIdDepuisRoute(request);
    const validationId = validerIdEvenement(id);
    if (!validationId.success) {
      return NextResponse.json({ erreur: validationId.error }, { status: 400 });
    }

    // 4) Suppression logique métier.
    const evenementSupprime = await evenementService.deleteEvenement(id, contexte.userId);
    return NextResponse.json(evenementSupprime, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('introuvable')) {
        return NextResponse.json({ erreur: error.message }, { status: 404 });
      }

      if (error.message.includes('Impossible de supprimer')) {
        return NextResponse.json({ erreur: error.message }, { status: 400 });
      }
    }

    console.error('Erreur DELETE /api/evenements/[id]:', error);
    await logger.log('ERROR', `Erreur DELETE /api/evenements/[id]: ${error}`);

    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}
