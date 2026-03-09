/**
 * Route API pour la gestion d'une transaction spécifique.
 * GET: récupération des détails d'une transaction.
 * PUT: mise à jour d'une transaction.
 * DELETE: suppression logique d'une transaction.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification, validerRole } from '@/middleware/auth.middleware';
import { TransactionService } from '@/modules/transactions/transaction.service';
import logger from '@/lib/logger';
import {
  validerIdTransaction,
  validerUpdateTransactionDTO,
} from '@/validations/transaction.schema';

const transactionService = new TransactionService();

/**
 * GET /api/transactions/[id]
 * Autorisé pour: ADMIN, RESPONSABLE, TRESORIER, AUDITEUR
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
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

    // 3) Validation de l'ID.
    const validationId = validerIdTransaction(params.id);
    if (!validationId.success) {
      return NextResponse.json({ erreur: validationId.error }, { status: 400 });
    }

    // 4) Récupération de la transaction.
    const transaction = await transactionService.findById(validationId.data);

    if (!transaction) {
      return NextResponse.json(
        { erreur: 'Transaction introuvable' },
        { status: 404 }
      );
    }

    return NextResponse.json(transaction, { status: 200 });
  } catch (error) {
    console.error('Erreur GET /api/transactions/[id]:', error);
    await logger.log('ERROR', `Erreur GET /api/transactions/[id]: ${error}`);

    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * PUT /api/transactions/[id]
 * Autorisé pour: ADMIN, RESPONSABLE, TRESORIER
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    // 1) Authentification du demandeur.
    const contexte = await validerAuthentification(request);
    if (contexte instanceof NextResponse) {
      return contexte;
    }

    // 2) Contrôle du rôle pour modification.
    const erreurRole = validerRole(contexte, ['ADMIN', 'RESPONSABLE', 'TRESORIER']);
    if (erreurRole) {
      return erreurRole;
    }

    // 3) Validation de l'ID.
    const validationId = validerIdTransaction(params.id);
    if (!validationId.success) {
      return NextResponse.json({ erreur: validationId.error }, { status: 400 });
    }

    // 4) Validation du payload de mise à jour.
    const body: unknown = await request.json();
    const validationBody = validerUpdateTransactionDTO(body);
    if (!validationBody.success) {
      return NextResponse.json({ erreur: validationBody.error }, { status: 400 });
    }

    // 5) Mise à jour métier.
    const transaction = await transactionService.update(
      validationId.data,
      validationBody.data,
      contexte.userId
    );

    return NextResponse.json(transaction, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes('introuvable') ||
        error.message.includes('désactivé') ||
        error.message.includes('ne correspond pas')
      ) {
        return NextResponse.json({ erreur: error.message }, { status: 400 });
      }
    }

    console.error('Erreur PUT /api/transactions/[id]:', error);
    await logger.log('ERROR', `Erreur PUT /api/transactions/[id]: ${error}`);

    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * DELETE /api/transactions/[id]
 * Suppression logique.
 * Autorisé pour: ADMIN, TRESORIER
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    // 1) Authentification du demandeur.
    const contexte = await validerAuthentification(request);
    if (contexte instanceof NextResponse) {
      return contexte;
    }

    // 2) Contrôle du rôle pour suppression (seuls ADMIN et TRESORIER).
    const erreurRole = validerRole(contexte, ['ADMIN', 'TRESORIER']);
    if (erreurRole) {
      return erreurRole;
    }

    // 3) Validation de l'ID.
    const validationId = validerIdTransaction(params.id);
    if (!validationId.success) {
      return NextResponse.json({ erreur: validationId.error }, { status: 400 });
    }

    // 4) Suppression logique.
    const transaction = await transactionService.softDelete(
      validationId.data,
      contexte.userId
    );

    return NextResponse.json(
      {
        message: 'Transaction supprimée avec succès',
        transaction,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('introuvable')) {
        return NextResponse.json({ erreur: error.message }, { status: 404 });
      }
      if (error.message.includes('répartition de dîme')) {
        return NextResponse.json({ erreur: error.message }, { status: 400 });
      }
    }

    console.error('Erreur DELETE /api/transactions/[id]:', error);
    await logger.log('ERROR', `Erreur DELETE /api/transactions/[id]: ${error}`);

    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}
