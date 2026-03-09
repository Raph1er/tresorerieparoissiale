/**
 * Route API pour la gestion des évènements.
 * GET: liste paginée et filtrée des évènements.
 * POST: création d'un nouvel évènement.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification, validerRole } from '@/middleware/auth.middleware';
import { evenementService } from '@/modules/evenements/evenement.service';
import logger from '@/lib/logger';
import {
  validerCreateEvenementDTO,
  validerPaginationEvenementQuery,
} from '@/validations/evenement.schema';

/**
 * GET /api/evenements
 * Autorisé pour: ADMIN, RESPONSABLE, TRESORIER, AUDITEUR
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 1) Authentification du demandeur.
    const contexte = await validerAuthentification(request);
    if (contexte instanceof NextResponse) {
      return contexte;
    }

    // 2) Contrôle du rôle pour lecture.
    const erreurRole = validerRole(contexte, [
      'ADMIN',
      'RESPONSABLE',
      'TRESORIER',
      'AUDITEUR',
    ]);
    if (erreurRole) {
      return erreurRole;
    }

    // 3) Validation des query params (pagination + filtres).
    const { searchParams } = new URL(request.url);
    const validationQuery = validerPaginationEvenementQuery(searchParams);
    if (!validationQuery.success) {
      return NextResponse.json({ erreur: validationQuery.error }, { status: 400 });
    }

    // 4) Récupération via service.
    const resultat = await evenementService.getAllEvenements(
      validationQuery.data.pagination,
      validationQuery.data.filters
    );

    return NextResponse.json(resultat, { status: 200 });
  } catch (error) {
    console.error('Erreur GET /api/evenements:', error);
    await logger.log('ERROR', `Erreur GET /api/evenements: ${error}`);

    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * POST /api/evenements
 * Autorisé pour: ADMIN, RESPONSABLE, TRESORIER
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1) Authentification du demandeur.
    const contexte = await validerAuthentification(request);
    if (contexte instanceof NextResponse) {
      return contexte;
    }

    // 2) Contrôle du rôle pour création.
    const erreurRole = validerRole(contexte, ['ADMIN', 'RESPONSABLE', 'TRESORIER']);
    if (erreurRole) {
      return erreurRole;
    }

    // 3) Lecture et validation du payload JSON.
    const body: unknown = await request.json();
    const validationBody = validerCreateEvenementDTO(body);
    if (!validationBody.success) {
      return NextResponse.json({ erreur: validationBody.error }, { status: 400 });
    }

    // 4) Création métier.
    const evenement = await evenementService.createEvenement(
      validationBody.data,
      contexte.userId
    );

    return NextResponse.json(evenement, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes('existe déjà') ||
        error.message.includes('introuvable') ||
        error.message.includes('passé')
      ) {
        return NextResponse.json({ erreur: error.message }, { status: 400 });
      }
    }

    console.error('Erreur POST /api/evenements:', error);
    await logger.log('ERROR', `Erreur POST /api/evenements: ${error}`);

    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}
