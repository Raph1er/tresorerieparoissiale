/**
 * Route API pour la gestion des enregistrements d'un cahier.
 * GET: liste paginée et filtrée des enregistrements.
 * POST: création d'un nouvel enregistrement (code généré automatiquement).
 */

import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification, validerRole } from '@/middleware/auth.middleware';
import { paudiumService } from '@/modules/paudium/paudium.service';
import logger from '@/lib/logger';
import {
	createEnregistrementSchema,
	paginationEnregistrementQuerySchema,
} from '@/validations/paudium.schema';

// Next.js 15+: params est une Promise
interface RouteContext {
	params: Promise<{ id: string }>;
}

/**
 * GET /api/paudium/[id]/enregistrements
 * Autorisé pour: ADMIN, RESPONSABLE, TRESORIER, AUDITEUR
 */
export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
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

		const { id } = await context.params;
		const cahierId = parseInt(id, 10);
		if (isNaN(cahierId)) {
			return NextResponse.json({ erreur: 'ID de cahier invalide' }, { status: 400 });
		}

		const { searchParams } = new URL(request.url);
		const validationQuery = paginationEnregistrementQuerySchema.safeParse(
			Object.fromEntries(searchParams)
		);
		if (!validationQuery.success) {
			return NextResponse.json({ erreur: validationQuery.error.flatten() }, { status: 400 });
		}

		const resultat = await paudiumService.getEnregistrementsByCahier(
			cahierId,
			{
				page: validationQuery.data.page,
				limit: validationQuery.data.limit,
				orderBy: validationQuery.data.orderBy,
				order: validationQuery.data.order,
			},
			{
				search: validationQuery.data.search,
				dateDebut: validationQuery.data.dateDebut,
				dateFin: validationQuery.data.dateFin,
			}
		);

		return NextResponse.json(resultat, { status: 200 });
	} catch (error) {
		if (error instanceof Error && error.message.includes('introuvable')) {
			return NextResponse.json({ erreur: error.message }, { status: 404 });
		}

		console.error('Erreur GET /api/paudium/[id]/enregistrements:', error);
		await logger.log(
			'ERROR',
			`Erreur GET /api/paudium/[id]/enregistrements: ${error}`
		);

		return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
	}
}

/**
 * POST /api/paudium/[id]/enregistrements
 * Autorisé pour: ADMIN, RESPONSABLE, TRESORIER
 * Le code est généré automatiquement par le service.
 */
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
	try {
		const contexte = await validerAuthentification(request);
		if (contexte instanceof NextResponse) {
			return contexte;
		}

		const erreurRole = validerRole(contexte, ['ADMIN', 'RESPONSABLE', 'TRESORIER']);
		if (erreurRole) {
			return erreurRole;
		}

		const { id } = await context.params;
		const cahierId = parseInt(id, 10);
		if (isNaN(cahierId)) {
			return NextResponse.json({ erreur: 'ID de cahier invalide' }, { status: 400 });
		}

		const body: unknown = await request.json();
		const validationBody = createEnregistrementSchema.safeParse(body);
		if (!validationBody.success) {
			return NextResponse.json({ erreur: validationBody.error.flatten() }, { status: 400 });
		}

		const enregistrement = await paudiumService.createEnregistrement(
			{
				...validationBody.data,
				cahierId,
			},
			contexte.userId
		);

		return NextResponse.json(enregistrement, { status: 201 });
	} catch (error) {
		if (error instanceof Error) {
			if (
				error.message.includes('introuvable') ||
				error.message.includes('inactif') ||
				error.message.includes('requis') ||
				error.message.includes('positif')
			) {
				return NextResponse.json({ erreur: error.message }, { status: 400 });
			}
		}

		console.error('Erreur POST /api/paudium/[id]/enregistrements:', error);
		await logger.log(
			'ERROR',
			`Erreur POST /api/paudium/[id]/enregistrements: ${error}`
		);

		return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
	}
}