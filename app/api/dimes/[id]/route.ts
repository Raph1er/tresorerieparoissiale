/**
 * Route API pour une repartition de dime specifique.
 * GET: recuperation detail.
 * DELETE: suppression administrative.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification, validerRole } from '@/middleware/auth.middleware';
import logger from '@/lib/logger';
import { dimeService } from '@/modules/dimes/dime.service';
import { validerIdRepartitionDime } from '@/validations/dime.schema';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
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

    const validationId = validerIdRepartitionDime(params.id);
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
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const contexte = await validerAuthentification(request);
    if (contexte instanceof NextResponse) {
      return contexte;
    }

    const erreurRole = validerRole(contexte, ['ADMIN']);
    if (erreurRole) {
      return erreurRole;
    }

    const validationId = validerIdRepartitionDime(params.id);
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
