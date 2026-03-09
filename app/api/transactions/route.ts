/**
 * Route API pour la gestion des transactions.
 * GET: liste paginée et filtrée des transactions.
 * POST: création d'une nouvelle transaction.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification, validerRole } from '@/middleware/auth.middleware';
import { TransactionService } from '@/modules/transactions/transaction.service';
import logger from '@/lib/logger';
import {
  validerCreateTransactionDTO,
  validerPaginationTransactionQuery,
} from '@/validations/transaction.schema';

const transactionService = new TransactionService();

/**
 * GET /api/transactions
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
    const queryObj = Object.fromEntries(searchParams.entries());
    const validationQuery = validerPaginationTransactionQuery(queryObj);
    if (!validationQuery.success) {
      return NextResponse.json({ erreur: validationQuery.error }, { status: 400 });
    }

    const { page, limit, ...filters } = validationQuery.data;

    // 4) Récupération via service.
    const resultat = await transactionService.findMany({ page, limit }, filters);

    return NextResponse.json(resultat, { status: 200 });
  } catch (error) {
    console.error('Erreur GET /api/transactions:', error);
    await logger.log('ERROR', `Erreur GET /api/transactions: ${error}`);

    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * POST /api/transactions
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
    const validationBody = validerCreateTransactionDTO(body);
    if (!validationBody.success) {
      return NextResponse.json({ erreur: validationBody.error }, { status: 400 });
    }

    // 4) Création métier.
    const transaction = await transactionService.create(
      validationBody.data,
      contexte.userId
    );

    return NextResponse.json(transaction, { status: 201 });
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

    console.error('Erreur POST /api/transactions:', error);
    await logger.log('ERROR', `Erreur POST /api/transactions: ${error}`);

    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}
