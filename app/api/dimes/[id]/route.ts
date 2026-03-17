/**
 * Route API pour une repartition de dime specifique.
 * GET: recuperation detail.
 * DELETE: suppression administrative.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification, validerRole } from '@/middleware/auth.middleware';
import logger from '@/lib/logger';
import { dimeService } from '@/modules/dimes/dime.service';
import {
  validerIdRepartitionDime,
  validerUpdateRepartitionDimeDTO,
} from '@/validations/dime.schema';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Next.js 16 fournit params comme une Promise dans les route handlers dynamiques.
    const { id } = await context.params;

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

    const validationId = validerIdRepartitionDime(id);
    if (!validationId.success) {
      return NextResponse.json({ erreur: validationId.error }, { status: 400 });
    }

    const repartition = await dimeService.getRepartitionById(validationId.data);
    return NextResponse.json(repartition, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('introuvable')) {
      return NextResponse.json({ erreur: error.message }, { status: 404 });
    }

    console.error('Erreur GET /api/dimes/[id]:', error);
    await logger.log('ERROR', `Erreur GET /api/dimes/[id]: ${error}`);
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Même convention Next.js 16 pour la route DELETE dynamique.
    const { id } = await context.params;

    const contexte = await validerAuthentification(request);
    if (contexte instanceof NextResponse) {
      return contexte;
    }

    const erreurRole = validerRole(contexte, ['ADMIN']);
    if (erreurRole) {
      return erreurRole;
    }

    const validationId = validerIdRepartitionDime(id);
    if (!validationId.success) {
      return NextResponse.json({ erreur: validationId.error }, { status: 400 });
    }

    const repartition = await dimeService.deleteRepartition(validationId.data, contexte.userId);
    return NextResponse.json(repartition, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('introuvable')) {
      return NextResponse.json({ erreur: error.message }, { status: 404 });
    }

    console.error('Erreur DELETE /api/dimes/[id]:', error);
    await logger.log('ERROR', `Erreur DELETE /api/dimes/[id]: ${error}`);
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    const contexte = await validerAuthentification(request);
    if (contexte instanceof NextResponse) {
      return contexte;
    }

    const erreurRole = validerRole(contexte, ['ADMIN', 'RESPONSABLE', 'TRESORIER']);
    if (erreurRole) {
      return erreurRole;
    }

    const validationId = validerIdRepartitionDime(id);
    if (!validationId.success) {
      return NextResponse.json({ erreur: validationId.error }, { status: 400 });
    }

    const body: unknown = await request.json();
    const validationBody = validerUpdateRepartitionDimeDTO(body);
    if (!validationBody.success) {
      return NextResponse.json({ erreur: validationBody.error }, { status: 400 });
    }

    const repartition = await dimeService.updateRepartition(
      validationId.data,
      validationBody.data,
      contexte.userId
    );

    return NextResponse.json(repartition, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('introuvable') || error.message.includes('inactif')) {
        return NextResponse.json({ erreur: error.message }, { status: 404 });
      }
      if (error.message.includes('superieur a 0')) {
        return NextResponse.json({ erreur: error.message }, { status: 400 });
      }
    }

    console.error('Erreur PUT /api/dimes/[id]:', error);
    await logger.log('ERROR', `Erreur PUT /api/dimes/[id]: ${error}`);
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}
