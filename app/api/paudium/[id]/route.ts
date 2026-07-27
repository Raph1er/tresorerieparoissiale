/**
 * Route API pour la gestion d'un cahier spécifique.
 * GET: détails d'un cahier.
 * PUT: mise à jour d'un cahier.
 * DELETE: suppression définitive d'un cahier.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification, validerRole } from '@/middleware/auth.middleware';
import { paudiumService } from '@/modules/paudium/paudium.service';
import logger from '@/lib/logger';
import { updateCahierSchema } from '@/validations/paudium.schema';

// Next.js 15+: params est une Promise
interface RouteContext {
	params: Promise<{ id: string }>;
}

/**
 * GET /api/paudium/[id]
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

		// Next.js 15+: on doit await params
		const { id } = await context.params;
		const cahierId = parseInt(id, 10);
		if (isNaN(cahierId)) {
			return NextResponse.json({ erreur: 'ID invalide' }, { status: 400 });
		}

		const cahier = await paudiumService.getCahierById(cahierId);

		return NextResponse.json(cahier, { status: 200 });
	} catch (error) {
		if (error instanceof Error && error.message.includes('introuvable')) {
			return NextResponse.json({ erreur: error.message }, { status: 404 });
		}

		console.error('Erreur GET /api/paudium/[id]:', error);
		await logger.log('ERROR', `Erreur GET /api/paudium/[id]: ${error}`);

		return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
	}
}

/**
 * PUT /api/paudium/[id]
 * Autorisé pour: ADMIN, RESPONSABLE, TRESORIER
 */
export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
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
			return NextResponse.json({ erreur: 'ID invalide' }, { status: 400 });
		}

		const body: unknown = await request.json();
		const validationBody = updateCahierSchema.safeParse(body);
		if (!validationBody.success) {
			return NextResponse.json({ erreur: validationBody.error.flatten() }, { status: 400 });
		}

		const cahier = await paudiumService.updateCahier(
			cahierId,
			validationBody.data,
			contexte.userId
		);

		return NextResponse.json(cahier, { status: 200 });
	} catch (error) {
		if (error instanceof Error) {
			if (
				error.message.includes('introuvable') ||
				error.message.includes('existe déjà') ||
				error.message.includes('vide')
			) {
				return NextResponse.json({ erreur: error.message }, { status: 400 });
			}
		}

		console.error('Erreur PUT /api/paudium/[id]:', error);
		await logger.log('ERROR', `Erreur PUT /api/paudium/[id]: ${error}`);

		return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
	}
}

/**
 * DELETE /api/paudium/[id]
 * Autorisé pour: ADMIN, RESPONSABLE
 */
export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
	try {
		const contexte = await validerAuthentification(request);
		if (contexte instanceof NextResponse) {
			return contexte;
		}

		const erreurRole = validerRole(contexte, ['ADMIN', 'RESPONSABLE']);
		if (erreurRole) {
			return erreurRole;
		}

		const { id } = await context.params;
		const cahierId = parseInt(id, 10);
		if (isNaN(cahierId)) {
			return NextResponse.json({ erreur: 'ID invalide' }, { status: 400 });
		}

		const cahier = await paudiumService.deleteCahier(cahierId, contexte.userId);

		return NextResponse.json(cahier, { status: 200 });
	} catch (error) {
		if (error instanceof Error && error.message.includes('introuvable')) {
			return NextResponse.json({ erreur: error.message }, { status: 404 });
		}

		console.error('Erreur DELETE /api/paudium/[id]:', error);
		await logger.log('ERROR', `Erreur DELETE /api/paudium/[id]: ${error}`);

		return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
	}
}