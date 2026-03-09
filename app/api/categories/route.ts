/**
 * Route API pour la gestion des catégories.
 * GET: liste paginée et filtrée des catégories.
 * POST: création d'une nouvelle catégorie.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification, validerRole } from '@/middleware/auth.middleware';
import { categorieService } from '@/modules/categories/categorie.service';
import logger from '@/lib/logger';
import {
	validerCreateCategorieDTO,
	validerPaginationCategorieQuery,
} from '@/validations/categorie.schema';

/**
 * GET /api/categories
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
		const validationQuery = validerPaginationCategorieQuery(searchParams);
		if (!validationQuery.success) {
			return NextResponse.json({ erreur: validationQuery.error }, { status: 400 });
		}

		// 4) Récupération via service.
		const resultat = await categorieService.getAllCategories(
			validationQuery.data.pagination,
			validationQuery.data.filters
		);

		return NextResponse.json(resultat, { status: 200 });
	} catch (error) {
		console.error('Erreur GET /api/categories:', error);
		await logger.log('ERROR', `Erreur GET /api/categories: ${error}`);

		return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
	}
}

/**
 * POST /api/categories
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
		const validationBody = validerCreateCategorieDTO(body);
		if (!validationBody.success) {
			return NextResponse.json({ erreur: validationBody.error }, { status: 400 });
		}

		// 4) Création métier.
		const categorie = await categorieService.createCategorie(
			validationBody.data,
			contexte.userId
		);

		return NextResponse.json(categorie, { status: 201 });
	} catch (error) {
		if (error instanceof Error) {
			if (
				error.message.includes('existe déjà') ||
				error.message.includes('introuvable') ||
				error.message.includes('identique')
			) {
				return NextResponse.json({ erreur: error.message }, { status: 400 });
			}
		}

		console.error('Erreur POST /api/categories:', error);
		await logger.log('ERROR', `Erreur POST /api/categories: ${error}`);

		return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
	}
}

