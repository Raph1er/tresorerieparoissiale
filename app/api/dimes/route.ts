/**
 * Route API pour la gestion des repartitions de dimes.
 * GET: liste paginee et filtree.
 * POST: creation d'une repartition.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification, validerRole } from '@/middleware/auth.middleware';
import logger from '@/lib/logger';
import { dimeService } from '@/modules/dimes/dime.service';
import {
  validerCreateRepartitionDimeDTO,
  validerPaginationDimeQuery,
} from '@/validations/dime.schema';

function formatterErreur(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function estErreurReseauTransitoire(error: unknown): boolean {
  const texte = formatterErreur(error).toLowerCase();
  return (
    texte.includes('fetch failed') ||
    texte.includes('und_err_socket') ||
    texte.includes('other side closed')
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const contexte = await validerAuthentification(request);
    if (contexte instanceof NextResponse) {
      return contexte;
    }

    const erreurRole = validerRole(contexte, [
      'ADMIN',
      'RESPONSABLE',
      'TRESORIER',
      'AUDITEUR',
    ]);
    if (erreurRole) {
      return erreurRole;
    }

    const { searchParams } = new URL(request.url);
    const validationQuery = validerPaginationDimeQuery(searchParams);
    if (!validationQuery.success) {
      return NextResponse.json({ erreur: validationQuery.error }, { status: 400 });
    }

    let resultat;
    try {
      resultat = await dimeService.getAllRepartitions(
        validationQuery.data.pagination,
        validationQuery.data.filters
      );
    } catch (error) {
      if (!estErreurReseauTransitoire(error)) {
        throw error;
      }

      // Une relance absorbe la majorite des fermetures de socket sporadiques cote Supabase.
      resultat = await dimeService.getAllRepartitions(
        validationQuery.data.pagination,
        validationQuery.data.filters
      );
    }

    return NextResponse.json(resultat, { status: 200 });
  } catch (error) {
    console.error('Erreur GET /api/dimes:', error);
    await logger.log('ERROR', `Erreur GET /api/dimes: ${formatterErreur(error)}`);
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const contexte = await validerAuthentification(request);
    if (contexte instanceof NextResponse) {
      return contexte;
    }

    const erreurRole = validerRole(contexte, ['ADMIN', 'RESPONSABLE', 'TRESORIER']);
    if (erreurRole) {
      return erreurRole;
    }

    const body: unknown = await request.json();
    const validationBody = validerCreateRepartitionDimeDTO(body);
    if (!validationBody.success) {
      return NextResponse.json({ erreur: validationBody.error }, { status: 400 });
    }

    const repartition = await dimeService.createRepartition(
      validationBody.data,
      contexte.userId
    );

    return NextResponse.json(repartition, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes('introuvable') ||
        error.message.includes('existe deja') ||
        error.message.includes('ENTREE') ||
        error.message.includes('positif') ||
        error.message.includes('supprimee')
      ) {
        return NextResponse.json({ erreur: error.message }, { status: 400 });
      }
    }

    console.error('Erreur POST /api/dimes:', error);
    await logger.log('ERROR', `Erreur POST /api/dimes: ${formatterErreur(error)}`);
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}
