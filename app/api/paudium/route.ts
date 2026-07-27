/**
 * Route API pour la gestion des cahiers du Paudium.
 * GET: liste paginée et filtrée des cahiers.
 * POST: création d'un nouveau cahier.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification, validerRole } from '@/middleware/auth.middleware';
import { paudiumService } from '@/modules/paudium/paudium.service';
import logger from '@/lib/logger';
import {
	createCahierSchema,
	paginationCahierQuerySchema,
} from '@/validations/paudium.schema';

/**
 * GET /api/paudium
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
		const validationQuery = paginationCahierQuerySchema.safeParse(
			Object.fromEntries(searchParams)
		);
		if (!validationQuery.success) {
			return NextResponse.json({ erreur: validationQuery.error.flatten() }, { status: 400 });
		}

		// 4) Récupération via service.
		const utilisateurId = contexte.role !== 'ADMIN' ? contexte.userId : undefined;
		const resultat = await paudiumService.getAllCahiers(
			{
				page: validationQuery.data.page,
				limit: validationQuery.data.limit,
				orderBy: validationQuery.data.orderBy,
				order: validationQuery.data.order,
			},
			{
				search: validationQuery.data.search,
				actif: validationQuery.data.actif,
				evenementId: validationQuery.data.evenementId,
			},
			utilisateurId
		);

		return NextResponse.json(resultat, { status: 200 });
	} catch (error) {
		console.error('Erreur GET /api/paudium:', error);
		await logger.log('ERROR', `Erreur GET /api/paudium: ${error}`);

		return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
	}
}

/**
 * POST /api/paudium
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
		const validationBody = createCahierSchema.safeParse(body);
		if (!validationBody.success) {
			return NextResponse.json({ erreur: validationBody.error.flatten() }, { status: 400 });
		}

		// 4) Création métier.
		const cahier = await paudiumService.createCahier(
			validationBody.data,
			contexte.userId,
			contexte.role === 'ADMIN'
		);

		return NextResponse.json(cahier, { status: 201 });
	} catch (error: any) {
		console.error('=== ERREUR POST /api/paudium ===');
		console.error('Type:', typeof error);
		console.error('Constructor:', error?.constructor?.name);
		console.error('Error complet:', JSON.stringify(error, null, 2));
		
		if (error?.code) console.error('Code:', error.code);
		if (error?.details) console.error('Details:', error.details);
		if (error?.hint) console.error('Hint:', error.hint);
		console.error('================================');

		// Si c'est une Error standard
		if (error instanceof Error) {
			const msg = error.message;
			if (
				msg.includes('existe déjà') ||
				msg.includes('introuvable') ||
				msg.includes('requis') ||
				msg.includes('Erreur Supabase')
			) {
				return NextResponse.json({ erreur: msg }, { status: 400 });
			}
		}

		// Si c'est un objet Supabase
		if (error?.message) {
			const msg = String(error.message);
			if (msg && msg.trim() !== '') {
				if (
					msg.includes('existe déjà') ||
					msg.includes('introuvable') ||
					msg.includes('requis')
				) {
					return NextResponse.json({ erreur: msg }, { status: 400 });
				}
			}
		}

		// Message d'erreur générique avec détails
		const errorMessage = error?.message || error?.details || error?.hint || 'Erreur serveur lors de la création';
		
		return NextResponse.json({ 
			erreur: errorMessage
		}, { status: 500 });
	}
}