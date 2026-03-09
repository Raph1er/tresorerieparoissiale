/**
 * Route API pour les opérations sur une catégorie précise.
 * GET: récupérer une catégorie.
 * PUT: mettre à jour une catégorie.
 * DELETE: suppression logique d'une catégorie.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification, validerRole } from '@/middleware/auth.middleware';
import { categorieService } from '@/modules/categories/categorie.service';
import logger from '@/lib/logger';
import { validerUpdateCategorieDTO } from '@/validations/categorie.schema';

/**
 * Extrait l'identifiant numérique depuis l'URL /api/categories/[id].
 */
function extraireIdDepuisRoute(request: NextRequest): number {
	const url = new URL(request.url);
	return parseInt(url.pathname.split('/').pop() || '0', 10);
}

/**
 * GET /api/categories/[id]
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
		if (Number.isNaN(id) || id < 1) {
			return NextResponse.json({ erreur: 'ID invalide' }, { status: 400 });
		}

		// 4) Lecture via service.
		const categorie = await categorieService.getCategorieById(id);
		return NextResponse.json(categorie, { status: 200 });
	} catch (error) {
		if (error instanceof Error && error.message.includes('introuvable')) {
			return NextResponse.json({ erreur: error.message }, { status: 404 });
		}

		console.error('Erreur GET /api/categories/[id]:', error);
		await logger.log('ERROR', `Erreur GET /api/categories/[id]: ${error}`);

		return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
	}
}

/**
 * PUT /api/categories/[id]
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
		if (Number.isNaN(id) || id < 1) {
			return NextResponse.json({ erreur: 'ID invalide' }, { status: 400 });
		}

		// 4) Validation du payload de mise à jour.
		const body: unknown = await request.json();
		const validationBody = validerUpdateCategorieDTO(body);
		if (!validationBody.success) {
			return NextResponse.json({ erreur: validationBody.error }, { status: 400 });
		}

		// 5) Mise à jour métier.
		const categorieMiseAJour = await categorieService.updateCategorie(
			id,
			validationBody.data,
			contexte.userId
		);

		return NextResponse.json(categorieMiseAJour, { status: 200 });
	} catch (error) {
		if (error instanceof Error) {
			if (error.message.includes('introuvable')) {
				return NextResponse.json({ erreur: error.message }, { status: 404 });
			}

			if (
				error.message.includes('existe déjà') ||
				error.message.includes('parent') ||
				error.message.includes('Impossible') ||
				error.message.includes('propre parent')
			) {
				return NextResponse.json({ erreur: error.message }, { status: 400 });
			}
		}

		console.error('Erreur PUT /api/categories/[id]:', error);
		await logger.log('ERROR', `Erreur PUT /api/categories/[id]: ${error}`);

		return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
	}
}

/**
 * DELETE /api/categories/[id]
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
		if (Number.isNaN(id) || id < 1) {
			return NextResponse.json({ erreur: 'ID invalide' }, { status: 400 });
		}

		// 4) Suppression logique métier.
		const categorieSupprimee = await categorieService.deleteCategorie(id, contexte.userId);
		return NextResponse.json(categorieSupprimee, { status: 200 });
	} catch (error) {
		if (error instanceof Error) {
			if (error.message.includes('introuvable')) {
				return NextResponse.json({ erreur: error.message }, { status: 404 });
			}

			if (
				error.message.includes('catégories système') ||
				error.message.includes('Impossible de supprimer')
			) {
				return NextResponse.json({ erreur: error.message }, { status: 400 });
			}
		}

		console.error('Erreur DELETE /api/categories/[id]:', error);
		await logger.log('ERROR', `Erreur DELETE /api/categories/[id]: ${error}`);

		return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
	}
}

